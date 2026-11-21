#include <jni.h>
#include <android/log.h>

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <ctime>
#include <exception>
#include <mutex>
#include <new>
#include <string>
#include <vector>

#include "llama.h"

#define LOG_TAG "OnyxLlamaJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

constexpr int32_t MIN_CTX_SIZE = 512;
constexpr int32_t MAX_CTX_SIZE = 4096;
constexpr int32_t DEFAULT_CTX_SIZE = 2048;
constexpr int32_t SAFE_BATCH_SIZE = 512;
constexpr int32_t SAFE_UBATCH_SIZE = 256;

std::mutex g_engine_mutex;
llama_model *g_model = nullptr;
llama_context *g_ctx = nullptr;
bool g_backend_initialized = false;
std::atomic<bool> g_stop_requested{false};

struct ScopedJString {
    JNIEnv *env;
    jstring jstr;
    const char *chars;

    ScopedJString(JNIEnv *e, jstring s) : env(e), jstr(s), chars(nullptr) {
        if (env != nullptr && jstr != nullptr) {
            chars = env->GetStringUTFChars(jstr, nullptr);
        }
    }

    ~ScopedJString() {
        if (env != nullptr && jstr != nullptr && chars != nullptr) {
            env->ReleaseStringUTFChars(jstr, chars);
        }
    }

    ScopedJString(const ScopedJString &) = delete;
    ScopedJString &operator=(const ScopedJString &) = delete;
};

void unload_locked() {
    if (g_ctx != nullptr) {
        llama_free(g_ctx);
        g_ctx = nullptr;
    }
    if (g_model != nullptr) {
        llama_model_free(g_model);
        g_model = nullptr;
    }
}

/**
 * Extracts all complete valid UTF-8 sequences from pending, leaving any
 * trailing incomplete multi-byte UTF-8 sequence in pending for the next token.
 * Converts valid UTF-8 to UTF-16 so Android ART NewString() never aborts on
 * Bengali multi-byte characters or 4-byte emoji surrogate pairs.
 */
std::u16string consume_valid_utf8_to_utf16(std::string &pending) {
    std::u16string out;
    size_t i = 0;
    const size_t len = pending.size();

    while (i < len) {
        const uint8_t b0 = static_cast<uint8_t>(pending[i]);
        uint32_t cp = 0;
        size_t seq_len = 0;

        if (b0 < 0x80) {
            cp = b0;
            seq_len = 1;
        } else if ((b0 & 0xE0) == 0xC0) {
            seq_len = 2;
            if (i + seq_len > len) break;
            const uint8_t b1 = static_cast<uint8_t>(pending[i + 1]);
            if ((b1 & 0xC0) != 0x80) {
                i += 1;
                continue;
            }
            cp = ((b0 & 0x1F) << 6) | (b1 & 0x3F);
            if (cp < 0x80) {
                i += seq_len;
                continue;
            }
        } else if ((b0 & 0xF0) == 0xE0) {
            seq_len = 3;
            if (i + seq_len > len) break;
            const uint8_t b1 = static_cast<uint8_t>(pending[i + 1]);
            const uint8_t b2 = static_cast<uint8_t>(pending[i + 2]);
            if ((b1 & 0xC0) != 0x80 || (b2 & 0xC0) != 0x80) {
                i += 1;
                continue;
            }
            cp = ((b0 & 0x0F) << 12) | ((b1 & 0x3F) << 6) | (b2 & 0x3F);
            if (cp < 0x800 || (cp >= 0xD800 && cp <= 0xDFFF)) {
                i += seq_len;
                continue;
            }
        } else if ((b0 & 0xF8) == 0xF0) {
            seq_len = 4;
            if (i + seq_len > len) break;
            const uint8_t b1 = static_cast<uint8_t>(pending[i + 1]);
            const uint8_t b2 = static_cast<uint8_t>(pending[i + 2]);
            const uint8_t b3 = static_cast<uint8_t>(pending[i + 3]);
            if ((b1 & 0xC0) != 0x80 || (b2 & 0xC0) != 0x80 || (b3 & 0xC0) != 0x80) {
                i += 1;
                continue;
            }
            cp = ((b0 & 0x07) << 18) | ((b1 & 0x3F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F);
            if (cp < 0x10000 || cp > 0x10FFFF) {
                i += seq_len;
                continue;
            }
        } else {
            // Invalid leading byte; discard safely
            i += 1;
            continue;
        }

        if (cp <= 0xFFFF) {
            out.push_back(static_cast<char16_t>(cp));
        } else {
            cp -= 0x10000;
            out.push_back(static_cast<char16_t>(0xD800 + (cp >> 10)));
            out.push_back(static_cast<char16_t>(0xDC00 + (cp & 0x3FF)));
        }

        i += seq_len;
    }

    if (i > 0) {
        pending.erase(0, i);
    }
    return out;
}

bool emit_utf16_token(JNIEnv *env, jobject callback, jmethodID on_token_method, const std::u16string &text) {
    if (text.empty() || env == nullptr || callback == nullptr || on_token_method == nullptr) {
        return true;
    }

    jstring jtoken = env->NewString(
        reinterpret_cast<const jchar *>(text.data()),
        static_cast<jsize>(text.size())
    );
    if (jtoken == nullptr) {
        if (env->ExceptionCheck()) {
            env->ExceptionClear();
        }
        return false;
    }

    env->CallVoidMethod(callback, on_token_method, jtoken);
    env->DeleteLocalRef(jtoken);

    if (env->ExceptionCheck()) {
        LOGE("Java onToken callback threw an exception; aborting generation.");
        env->ExceptionClear();
        return false;
    }

    return true;
}

}  // namespace

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_hadi_onyx_LocalLLMPlugin_nativeLoadModel(
    JNIEnv *env,
    jobject /* thiz */,
    jstring modelPath,
    jint nCtx,
    jint nThreads
) {
    try {
        if (modelPath == nullptr) {
            LOGE("nativeLoadModel called with null modelPath");
            return JNI_FALSE;
        }

        ScopedJString path_guard(env, modelPath);
        if (path_guard.chars == nullptr || path_guard.chars[0] == '\0') {
            LOGE("nativeLoadModel received empty modelPath");
            return JNI_FALSE;
        }

        g_stop_requested.store(true);
        std::lock_guard<std::mutex> lock(g_engine_mutex);

        unload_locked();

        if (!g_backend_initialized) {
            llama_backend_init();
            g_backend_initialized = true;
        }

        const int32_t safe_ctx = std::clamp(
            static_cast<int32_t>(nCtx > 0 ? nCtx : DEFAULT_CTX_SIZE),
            MIN_CTX_SIZE,
            MAX_CTX_SIZE
        );
        const int32_t safe_threads = std::clamp(
            static_cast<int32_t>(nThreads > 0 ? nThreads : 4),
            1,
            8
        );

        llama_model_params model_params = llama_model_default_params();
        model_params.use_mmap = true;
        model_params.use_mlock = false;
        model_params.n_gpu_layers = 0;

        LOGI("Loading GGUF model: %s (n_ctx=%d, threads=%d)", path_guard.chars, safe_ctx, safe_threads);
        llama_model *model = llama_model_load_from_file(path_guard.chars, model_params);
        if (model == nullptr) {
            LOGE("llama_model_load_from_file failed for: %s", path_guard.chars);
            return JNI_FALSE;
        }

        llama_context_params ctx_params = llama_context_default_params();
        ctx_params.n_ctx = static_cast<uint32_t>(safe_ctx);
        ctx_params.n_batch = static_cast<uint32_t>(std::min(SAFE_BATCH_SIZE, safe_ctx));
        ctx_params.n_ubatch = static_cast<uint32_t>(std::min(SAFE_UBATCH_SIZE, safe_ctx));
        ctx_params.n_threads = safe_threads;
        ctx_params.n_threads_batch = safe_threads;
        ctx_params.no_perf = true;

        llama_context *ctx = llama_init_from_model(model, ctx_params);
        if (ctx == nullptr) {
            LOGE("llama_init_from_model failed (likely insufficient RAM for context size %d)", safe_ctx);
            llama_model_free(model);
            return JNI_FALSE;
        }

        g_model = model;
        g_ctx = ctx;
        g_stop_requested.store(false);

        LOGI("Model loaded successfully into native memory.");
        return JNI_TRUE;
    } catch (const std::bad_alloc &) {
        LOGE("Out of memory while loading GGUF model.");
        return JNI_FALSE;
    } catch (const std::exception &ex) {
        LOGE("Exception in nativeLoadModel: %s", ex.what());
        return JNI_FALSE;
    } catch (...) {
        LOGE("Unknown native error in nativeLoadModel.");
        return JNI_FALSE;
    }
}

JNIEXPORT jint JNICALL
Java_com_hadi_onyx_LocalLLMPlugin_nativeGenerate(
    JNIEnv *env,
    jobject /* thiz */,
    jstring prompt,
    jfloat temp,
    jint maxTokens,
    jobject callback
) {
    llama_sampler *sampler = nullptr;

    try {
        if (prompt == nullptr || callback == nullptr) {
            LOGE("nativeGenerate received null prompt or callback");
            return -1;
        }

        ScopedJString prompt_guard(env, prompt);
        if (prompt_guard.chars == nullptr) {
            return -1;
        }

        jclass cb_class = env->GetObjectClass(callback);
        if (cb_class == nullptr) {
            return -1;
        }
        jmethodID on_token_method = env->GetMethodID(cb_class, "onToken", "(Ljava/lang/String;)V");
        env->DeleteLocalRef(cb_class);
        if (on_token_method == nullptr) {
            if (env->ExceptionCheck()) {
                env->ExceptionClear();
            }
            LOGE("TokenCallback.onToken(String) method not found");
            return -1;
        }

        std::lock_guard<std::mutex> lock(g_engine_mutex);

        if (g_model == nullptr || g_ctx == nullptr) {
            LOGE("nativeGenerate called before model was loaded");
            return -2;
        }

        g_stop_requested.store(false);

        const llama_vocab *vocab = llama_model_get_vocab(g_model);
        if (vocab == nullptr) {
            LOGE("Failed to retrieve llama_vocab");
            return -2;
        }

        const int32_t n_ctx = static_cast<int32_t>(llama_n_ctx(g_ctx));
        const int32_t n_batch = std::max(1, static_cast<int32_t>(llama_n_batch(g_ctx)));
        const int32_t prompt_len = static_cast<int32_t>(std::strlen(prompt_guard.chars));

        // Reset KV cache for fresh stateless multi-turn prompt evaluation
        llama_kv_cache_clear(g_ctx);

        // Tokenize formatted prompt (two-pass sizing for safety)
        const int32_t required = -llama_tokenize(
            vocab,
            prompt_guard.chars,
            prompt_len,
            nullptr,
            0,
            true,
            true
        );

        if (required <= 0) {
            LOGE("Prompt tokenization returned empty token sequence");
            return -3;
        }

        std::vector<llama_token> prompt_tokens(static_cast<size_t>(required));
        const int32_t n_tokenized = llama_tokenize(
            vocab,
            prompt_guard.chars,
            prompt_len,
            prompt_tokens.data(),
            static_cast<int32_t>(prompt_tokens.size()),
            true,
            true
        );

        if (n_tokenized < 0) {
            LOGE("Prompt tokenization failed with code %d", n_tokenized);
            return -3;
        }
        prompt_tokens.resize(static_cast<size_t>(n_tokenized));

        // Keep prompt within safe context budget while preserving BOS + latest turns
        const int32_t max_prompt_tokens = std::max(64, n_ctx - 128);
        if (static_cast<int32_t>(prompt_tokens.size()) > max_prompt_tokens) {
            const llama_token bos = prompt_tokens.front();
            const size_t keep_tail = static_cast<size_t>(max_prompt_tokens - 1);
            std::vector<llama_token> trimmed;
            trimmed.reserve(static_cast<size_t>(max_prompt_tokens));
            trimmed.push_back(bos);
            trimmed.insert(
                trimmed.end(),
                prompt_tokens.end() - static_cast<std::ptrdiff_t>(keep_tail),
                prompt_tokens.end()
            );
            prompt_tokens.swap(trimmed);
            LOGW("Trimmed prompt to %zu tokens to stay within n_ctx=%d", prompt_tokens.size(), n_ctx);
        }

        // Prefill prompt in safe n_batch chunks
        const int32_t total_prompt = static_cast<int32_t>(prompt_tokens.size());
        for (int32_t offset = 0; offset < total_prompt; offset += n_batch) {
            if (g_stop_requested.load()) {
                return 0;
            }
            const int32_t chunk = std::min(n_batch, total_prompt - offset);
            llama_batch batch = llama_batch_get_one(prompt_tokens.data() + offset, chunk);
            if (llama_decode(g_ctx, batch) != 0) {
                LOGE("llama_decode failed during prompt prefill at offset %d", offset);
                return -4;
            }
        }

        // Initialize modern sampler chain
        llama_sampler_chain_params sparams = llama_sampler_chain_default_params();
        sparams.no_perf = true;
        sampler = llama_sampler_chain_init(sparams);

        const float clamped_temp = std::clamp(static_cast<float>(temp), 0.0f, 2.0f);
        if (clamped_temp <= 0.01f) {
            llama_sampler_chain_add(sampler, llama_sampler_init_greedy());
        } else {
            llama_sampler_chain_add(sampler, llama_sampler_init_top_k(40));
            llama_sampler_chain_add(sampler, llama_sampler_init_top_p(0.92f, 1));
            llama_sampler_chain_add(sampler, llama_sampler_init_min_p(0.05f, 1));
            llama_sampler_chain_add(sampler, llama_sampler_init_temp(clamped_temp));
            llama_sampler_chain_add(
                sampler,
                llama_sampler_init_dist(static_cast<uint32_t>(std::time(nullptr)))
            );
        }

        const int32_t remaining_ctx = std::max(0, n_ctx - total_prompt - 1);
        const int32_t target_max_tokens = std::clamp(
            static_cast<int32_t>(maxTokens > 0 ? maxTokens : 512),
            16,
            std::max(16, remaining_ctx)
        );

        std::string utf8_pending;
        std::vector<char> piece_buf(256);
        int32_t generated_count = 0;

        for (int32_t step = 0; step < target_max_tokens; ++step) {
            if (g_stop_requested.load()) {
                LOGI("Generation stopped by user after %d tokens.", generated_count);
                break;
            }

            const llama_token next_token = llama_sampler_sample(sampler, g_ctx, -1);
            llama_sampler_accept(sampler, next_token);

            if (llama_vocab_is_eog(vocab, next_token)) {
                break;
            }

            int32_t n_chars = llama_token_to_piece(
                vocab,
                next_token,
                piece_buf.data(),
                static_cast<int32_t>(piece_buf.size()),
                0,
                false
            );

            if (n_chars < 0) {
                piece_buf.resize(static_cast<size_t>(-n_chars) + 16);
                n_chars = llama_token_to_piece(
                    vocab,
                    next_token,
                    piece_buf.data(),
                    static_cast<int32_t>(piece_buf.size()),
                    0,
                    false
                );
            }

            if (n_chars > 0) {
                utf8_pending.append(piece_buf.data(), static_cast<size_t>(n_chars));
                const std::u16string ready_u16 = consume_valid_utf8_to_utf16(utf8_pending);
                if (!ready_u16.empty()) {
                    if (!emit_utf16_token(env, callback, on_token_method, ready_u16)) {
                        break;
                    }
                }
            }

            generated_count += 1;

            llama_token single_tok = next_token;
            llama_batch next_batch = llama_batch_get_one(&single_tok, 1);
            if (llama_decode(g_ctx, next_batch) != 0) {
                LOGW("llama_decode stopped early at generated token %d", generated_count);
                break;
            }
        }

        if (sampler != nullptr) {
            llama_sampler_free(sampler);
            sampler = nullptr;
        }

        return generated_count;
    } catch (const std::bad_alloc &) {
        if (sampler != nullptr) {
            llama_sampler_free(sampler);
        }
        LOGE("Out of memory during nativeGenerate.");
        return -5;
    } catch (const std::exception &ex) {
        if (sampler != nullptr) {
            llama_sampler_free(sampler);
        }
        LOGE("Exception in nativeGenerate: %s", ex.what());
        return -6;
    } catch (...) {
        if (sampler != nullptr) {
            llama_sampler_free(sampler);
        }
        LOGE("Unknown native error in nativeGenerate.");
        return -6;
    }
}

JNIEXPORT void JNICALL
Java_com_hadi_onyx_LocalLLMPlugin_nativeStopGeneration(
    JNIEnv * /* env */,
    jobject /* thiz */
) {
    g_stop_requested.store(true);
}

JNIEXPORT void JNICALL
Java_com_hadi_onyx_LocalLLMPlugin_nativeUnloadModel(
    JNIEnv * /* env */,
    jobject /* thiz */
) {
    try {
        g_stop_requested.store(true);
        std::lock_guard<std::mutex> lock(g_engine_mutex);
        unload_locked();
        LOGI("Unloaded GGUF model and freed native memory.");
    } catch (...) {
        LOGE("Unexpected error in nativeUnloadModel.");
    }
}

}  // extern "C"
