package com.hadi.onyx;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;
import android.os.StatFs;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "LocalLLM")
public class LocalLLMPlugin extends Plugin {
    private static final String TAG = "OnyxLocalLLM";
    private static final String MODELS_DIR_NAME = "models";
    private static final int MAX_REDIRECTS = 6;
    private static final int CONNECT_TIMEOUT_MS = 20000;
    private static final int READ_TIMEOUT_MS = 45000;
    private static final int DOWNLOAD_BUFFER_SIZE = 64 * 1024;
    private static final long PROGRESS_EMIT_INTERVAL_MS = 160L;
    private static final long MIN_STORAGE_HEADROOM_BYTES = 256L * 1024L * 1024L;
    private static final Pattern SAFE_FILENAME_PATTERN = Pattern.compile("^[a-zA-Z0-9._-]+\\.gguf$");

    private static volatile boolean nativeLibraryLoaded = false;

    static {
        try {
            System.loadLibrary("llama_jni");
            nativeLibraryLoaded = true;
        } catch (UnsatisfiedLinkError err) {
            Log.e(TAG, "Failed to load native llama_jni library", err);
            nativeLibraryLoaded = false;
        }
    }

    public interface TokenCallback {
        void onToken(String token);
    }

    private native boolean nativeLoadModel(String modelPath, int nCtx, int nThreads);
    private native int nativeGenerate(String prompt, float temp, int maxTokens, TokenCallback callback);
    private native void nativeStopGeneration();
    private native void nativeUnloadModel();

    private final ExecutorService downloadExecutor = Executors.newFixedThreadPool(2);
    private final ExecutorService inferenceExecutor = Executors.newSingleThreadExecutor();
    private final ConcurrentHashMap<String, DownloadControl> activeDownloads = new ConcurrentHashMap<>();
    private final AtomicBoolean isGenerating = new AtomicBoolean(false);

    private volatile String loadedModelFileName = null;
    private volatile int loadedModelCtx = 2048;

    private static final class DownloadControl {
        final AtomicBoolean paused = new AtomicBoolean(false);
        final AtomicBoolean cancelled = new AtomicBoolean(false);
    }

    private File getModelsDir() throws IOException {
        Context context = getContext();
        File dir = new File(context.getFilesDir(), MODELS_DIR_NAME);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("Could not create local models directory");
        }
        return dir;
    }

    private File resolveSafeModelFile(String rawFileName) throws IOException {
        if (rawFileName == null) {
            throw new IOException("Model filename is required");
        }
        String trimmed = rawFileName.trim();
        if (!SAFE_FILENAME_PATTERN.matcher(trimmed).matches() || trimmed.contains("..")) {
            throw new IOException("Invalid GGUF model filename");
        }
        File modelsDir = getModelsDir();
        File canonicalDir = modelsDir.getCanonicalFile();
        File targetFile = new File(canonicalDir, trimmed).getCanonicalFile();
        String dirPrefix = canonicalDir.getPath() + File.separator;
        if (!targetFile.getPath().startsWith(dirPrefix)) {
            throw new IOException("Model path escapes models directory");
        }
        return targetFile;
    }

    private File resolveSafePartFile(File modelFile) throws IOException {
        File modelsDir = getModelsDir().getCanonicalFile();
        File partFile = new File(modelsDir, modelFile.getName() + ".part").getCanonicalFile();
        String dirPrefix = modelsDir.getPath() + File.separator;
        if (!partFile.getPath().startsWith(dirPrefix)) {
            throw new IOException("Partial download path escapes models directory");
        }
        return partFile;
    }

    private boolean isAllowedModelHost(String host) {
        if (host == null || host.isEmpty()) {
            return false;
        }
        String lower = host.toLowerCase(Locale.US);
        return lower.equals("huggingface.co")
                || lower.endsWith(".huggingface.co")
                || lower.equals("hf.co")
                || lower.endsWith(".hf.co")
                || lower.endsWith(".cloudfront.net")
                || lower.endsWith(".xethub.hf.co");
    }

    private void validateDownloadUrl(URL url, boolean isInitialUrl) throws IOException {
        String protocol = url.getProtocol();
        if (!"https".equalsIgnoreCase(protocol)) {
            throw new IOException("Only HTTPS URLs are permitted for GGUF downloads");
        }
        String host = url.getHost();
        if (host == null || host.trim().isEmpty()) {
            throw new IOException("Download URL host is missing");
        }
        if (isInitialUrl && !isAllowedModelHost(host)) {
            throw new IOException("Downloads are restricted to verified Hugging Face hosts");
        }
        InetAddress[] addresses = InetAddress.getAllByName(host);
        for (InetAddress address : addresses) {
            if (address.isAnyLocalAddress()
                    || address.isLoopbackAddress()
                    || address.isLinkLocalAddress()
                    || address.isSiteLocalAddress()
                    || address.isMulticastAddress()) {
                throw new IOException("Download host resolved to a restricted network address");
            }
        }
    }

    private HttpURLConnection openDownloadConnection(String rawUrl, long resumeOffset) throws IOException {
        String currentUrl = rawUrl;
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            URL url = new URL(currentUrl);
            validateDownloadUrl(url, redirect == 0);

            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "OnyxAIOS-Android/1.0");
            if (resumeOffset > 0) {
                conn.setRequestProperty("Range", "bytes=" + resumeOffset + "-");
            }

            int status = conn.getResponseCode();
            if (status == HttpURLConnection.HTTP_MOVED_PERM
                    || status == HttpURLConnection.HTTP_MOVED_TEMP
                    || status == HttpURLConnection.HTTP_SEE_OTHER
                    || status == 307
                    || status == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.trim().isEmpty()) {
                    throw new IOException("Redirect response missing Location header");
                }
                currentUrl = new URL(url, location).toString();
                continue;
            }
            return conn;
        }
        throw new IOException("Too many redirects while downloading model");
    }

    private long getAvailableStorageBytes() {
        try {
            File modelsDir = getModelsDir();
            StatFs stat = new StatFs(modelsDir.getAbsolutePath());
            return stat.getAvailableBytes();
        } catch (Exception ex) {
            return 0L;
        }
    }

    private long getTotalStorageBytes() {
        try {
            File modelsDir = getModelsDir();
            StatFs stat = new StatFs(modelsDir.getAbsolutePath());
            return stat.getTotalBytes();
        } catch (Exception ex) {
            return 0L;
        }
    }

    private void emitDownloadProgress(
            String modelId,
            String fileName,
            long downloadedBytes,
            long totalBytes,
            double speedMBps,
            String status,
            String errorMessage
    ) {
        JSObject payload = new JSObject();
        payload.put("modelId", modelId != null ? modelId : "");
        payload.put("fileName", fileName);
        payload.put("downloadedBytes", downloadedBytes);
        payload.put("totalBytes", totalBytes);
        payload.put("downloadedMB", Math.round((downloadedBytes / (1024.0 * 1024.0)) * 10.0) / 10.0);
        payload.put("totalMB", totalBytes > 0 ? Math.round((totalBytes / (1024.0 * 1024.0)) * 10.0) / 10.0 : 0.0);
        double pct = totalBytes > 0 ? Math.min(100.0, (downloadedBytes * 100.0) / totalBytes) : 0.0;
        payload.put("progress", Math.round(pct * 10.0) / 10.0);
        payload.put("speedMBps", Math.round(speedMBps * 10.0) / 10.0);
        payload.put("status", status);
        if (errorMessage != null) {
            payload.put("error", errorMessage);
        }
        notifyListeners("downloadProgress", payload);
    }

    @PluginMethod
    public void downloadModel(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName");
        String modelId = call.getString("modelId", fileName);

        if (url == null || url.trim().isEmpty() || fileName == null || fileName.trim().isEmpty()) {
            call.reject("Both url and fileName are required");
            return;
        }

        final File targetFile;
        final File partFile;
        try {
            targetFile = resolveSafeModelFile(fileName);
            partFile = resolveSafePartFile(targetFile);
        } catch (IOException ex) {
            call.reject(ex.getMessage());
            return;
        }

        if (targetFile.exists() && targetFile.length() > 0) {
            JSObject result = new JSObject();
            result.put("fileName", targetFile.getName());
            result.put("sizeBytes", targetFile.length());
            result.put("status", "completed");
            emitDownloadProgress(modelId, targetFile.getName(), targetFile.length(), targetFile.length(), 0.0, "completed", null);
            call.resolve(result);
            return;
        }

        DownloadControl control = new DownloadControl();
        DownloadControl existing = activeDownloads.putIfAbsent(targetFile.getName(), control);
        if (existing != null) {
            call.reject("Model download is already in progress");
            return;
        }

        downloadExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                long existingBytes = partFile.exists() ? partFile.length() : 0L;
                conn = openDownloadConnection(url.trim(), existingBytes);

                int status = conn.getResponseCode();
                boolean appendMode = false;
                long totalBytes;

                if (status == HttpURLConnection.HTTP_PARTIAL && existingBytes > 0) {
                    appendMode = true;
                    long remaining = conn.getContentLengthLong();
                    totalBytes = remaining > 0 ? existingBytes + remaining : -1L;
                } else if (status == HttpURLConnection.HTTP_OK) {
                    existingBytes = 0L;
                    appendMode = false;
                    totalBytes = conn.getContentLengthLong();
                } else if (status == 416 && existingBytes > 0) {
                    // Partial file already complete or range invalid; reset and retry cleanly
                    if (partFile.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        partFile.delete();
                    }
                    conn.disconnect();
                    conn = openDownloadConnection(url.trim(), 0L);
                    if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                        throw new IOException("Server returned HTTP " + conn.getResponseCode());
                    }
                    existingBytes = 0L;
                    appendMode = false;
                    totalBytes = conn.getContentLengthLong();
                } else {
                    throw new IOException("Server returned HTTP " + status);
                }

                long neededBytes = totalBytes > 0 ? Math.max(0L, totalBytes - existingBytes) : 0L;
                long availableBytes = getAvailableStorageBytes();
                if (neededBytes > 0 && availableBytes > 0 && availableBytes < neededBytes + MIN_STORAGE_HEADROOM_BYTES) {
                    throw new IOException("Not enough free device storage for this model");
                }

                emitDownloadProgress(modelId, targetFile.getName(), existingBytes, totalBytes, 0.0, "downloading", null);

                long downloaded = existingBytes;
                long lastEmitTime = System.currentTimeMillis();
                long lastEmitBytes = downloaded;

                try (InputStream in = new BufferedInputStream(conn.getInputStream(), DOWNLOAD_BUFFER_SIZE);
                     FileOutputStream out = new FileOutputStream(partFile, appendMode)) {
                    byte[] buffer = new byte[DOWNLOAD_BUFFER_SIZE];
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        if (control.cancelled.get()) {
                            out.flush();
                            break;
                        }
                        if (control.paused.get()) {
                            out.flush();
                            break;
                        }

                        out.write(buffer, 0, bytesRead);
                        downloaded += bytesRead;

                        long now = System.currentTimeMillis();
                        if (now - lastEmitTime >= PROGRESS_EMIT_INTERVAL_MS) {
                            double elapsedSec = Math.max(0.05, (now - lastEmitTime) / 1000.0);
                            double speedMBps = ((downloaded - lastEmitBytes) / (1024.0 * 1024.0)) / elapsedSec;
                            emitDownloadProgress(modelId, targetFile.getName(), downloaded, totalBytes, speedMBps, "downloading", null);
                            lastEmitTime = now;
                            lastEmitBytes = downloaded;
                        }
                    }
                    out.flush();
                }

                if (control.cancelled.get()) {
                    if (partFile.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        partFile.delete();
                    }
                    emitDownloadProgress(modelId, targetFile.getName(), 0L, totalBytes, 0.0, "cancelled", null);
                    JSObject res = new JSObject();
                    res.put("fileName", targetFile.getName());
                    res.put("status", "cancelled");
                    call.resolve(res);
                    return;
                }

                if (control.paused.get()) {
                    emitDownloadProgress(modelId, targetFile.getName(), downloaded, totalBytes, 0.0, "paused", null);
                    JSObject res = new JSObject();
                    res.put("fileName", targetFile.getName());
                    res.put("downloadedBytes", downloaded);
                    res.put("totalBytes", totalBytes);
                    res.put("status", "paused");
                    call.resolve(res);
                    return;
                }

                if (totalBytes > 0 && downloaded < totalBytes) {
                    throw new IOException("Download ended unexpectedly before completion");
                }

                if (targetFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    targetFile.delete();
                }
                if (!partFile.renameTo(targetFile)) {
                    throw new IOException("Failed to finalize downloaded GGUF model file");
                }

                emitDownloadProgress(modelId, targetFile.getName(), downloaded, downloaded, 0.0, "completed", null);
                JSObject res = new JSObject();
                res.put("fileName", targetFile.getName());
                res.put("sizeBytes", targetFile.length());
                res.put("status", "completed");
                call.resolve(res);
            } catch (Exception ex) {
                Log.e(TAG, "Model download failed for " + targetFile.getName(), ex);
                emitDownloadProgress(modelId, targetFile.getName(), partFile.exists() ? partFile.length() : 0L, 0L, 0.0, "error", ex.getMessage());
                call.reject("Download failed: " + ex.getMessage());
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
                activeDownloads.remove(targetFile.getName());
            }
        });
    }

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        String fileName = call.getString("fileName");
        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("fileName is required");
            return;
        }
        DownloadControl control = activeDownloads.get(fileName.trim());
        if (control != null) {
            control.paused.set(true);
        }
        JSObject res = new JSObject();
        res.put("paused", control != null);
        call.resolve(res);
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String fileName = call.getString("fileName");
        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("fileName is required");
            return;
        }
        String trimmed = fileName.trim();
        DownloadControl control = activeDownloads.get(trimmed);
        if (control != null) {
            control.cancelled.set(true);
        } else {
            try {
                File targetFile = resolveSafeModelFile(trimmed);
                File partFile = resolveSafePartFile(targetFile);
                if (partFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    partFile.delete();
                }
            } catch (IOException ignored) {
                // Ignore invalid name on cancel cleanup
            }
        }
        JSObject res = new JSObject();
        res.put("cancelled", true);
        call.resolve(res);
    }

    @PluginMethod
    public void getDownloadedModels(PluginCall call) {
        try {
            File modelsDir = getModelsDir();
            File[] files = modelsDir.listFiles();
            JSArray modelsArray = new JSArray();
            JSArray partialArray = new JSArray();
            long modelsTotalBytes = 0L;

            if (files != null) {
                Arrays.sort(files, Comparator.comparing(File::getName));
                for (File f : files) {
                    if (!f.isFile()) {
                        continue;
                    }
                    String name = f.getName();
                    if (name.endsWith(".gguf")) {
                        long size = f.length();
                        modelsTotalBytes += size;
                        JSObject item = new JSObject();
                        item.put("fileName", name);
                        item.put("sizeBytes", size);
                        item.put("sizeMB", Math.round((size / (1024.0 * 1024.0)) * 10.0) / 10.0);
                        item.put("lastModified", f.lastModified());
                        item.put("isLoaded", name.equals(loadedModelFileName));
                        modelsArray.put(item);
                    } else if (name.endsWith(".gguf.part")) {
                        long size = f.length();
                        modelsTotalBytes += size;
                        JSObject part = new JSObject();
                        part.put("fileName", name.substring(0, name.length() - 5));
                        part.put("downloadedBytes", size);
                        part.put("downloadedMB", Math.round((size / (1024.0 * 1024.0)) * 10.0) / 10.0);
                        partialArray.put(part);
                    }
                }
            }

            JSObject result = new JSObject();
            result.put("models", modelsArray);
            result.put("partials", partialArray);
            result.put("loadedModel", loadedModelFileName);
            result.put("availableStorageBytes", getAvailableStorageBytes());
            result.put("totalStorageBytes", getTotalStorageBytes());
            result.put("modelsStorageBytes", modelsTotalBytes);
            result.put("nativeReady", nativeLibraryLoaded);
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("Could not read local models directory: " + ex.getMessage());
        }
    }

    @PluginMethod
    public void deleteModel(PluginCall call) {
        String fileName = call.getString("fileName");
        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("fileName is required");
            return;
        }

        try {
            File targetFile = resolveSafeModelFile(fileName);
            File partFile = resolveSafePartFile(targetFile);

            DownloadControl control = activeDownloads.get(targetFile.getName());
            if (control != null) {
                control.cancelled.set(true);
            }

            if (targetFile.getName().equals(loadedModelFileName)) {
                if (nativeLibraryLoaded) {
                    nativeStopGeneration();
                    nativeUnloadModel();
                }
                loadedModelFileName = null;
            }

            boolean deletedMain = !targetFile.exists() || targetFile.delete();
            boolean deletedPart = !partFile.exists() || partFile.delete();

            JSObject res = new JSObject();
            res.put("deleted", deletedMain && deletedPart);
            res.put("fileName", targetFile.getName());
            call.resolve(res);
        } catch (Exception ex) {
            call.reject("Could not delete model: " + ex.getMessage());
        }
    }

    @PluginMethod
    public void loadModel(PluginCall call) {
        if (!nativeLibraryLoaded) {
            call.reject("Native llama.cpp engine library is unavailable on this device ABI");
            return;
        }

        String fileName = call.getString("fileName");
        int nCtx = call.getInt("nCtx", 2048);
        int defaultThreads = Math.max(2, Math.min(6, Runtime.getRuntime().availableProcessors() - 2));
        int requestedThreads = call.getInt("nThreads", defaultThreads);
        int safeThreads = Math.max(1, Math.min(8, requestedThreads));

        final File targetFile;
        try {
            targetFile = resolveSafeModelFile(fileName);
        } catch (IOException ex) {
            call.reject(ex.getMessage());
            return;
        }

        if (!targetFile.exists() || targetFile.length() == 0) {
            call.reject("Model file not found on device. Download the GGUF file first.");
            return;
        }

        inferenceExecutor.execute(() -> {
            try {
                if (isGenerating.get()) {
                    nativeStopGeneration();
                }

                boolean ok = nativeLoadModel(targetFile.getAbsolutePath(), nCtx, safeThreads);
                if (!ok) {
                    loadedModelFileName = null;
                    call.reject("Could not initialize GGUF model in memory. Try a smaller quantization or close background apps.");
                    return;
                }

                loadedModelFileName = targetFile.getName();
                loadedModelCtx = nCtx;

                JSObject res = new JSObject();
                res.put("loaded", true);
                res.put("fileName", targetFile.getName());
                res.put("nCtx", nCtx);
                res.put("nThreads", safeThreads);
                call.resolve(res);
            } catch (Exception ex) {
                loadedModelFileName = null;
                call.reject("Native model load error: " + ex.getMessage());
            }
        });
    }

    private String formatConversationPrompt(
            String modelHint,
            String systemPrompt,
            JSArray messages,
            String rawPrompt
    ) {
        String lowerModel = modelHint != null ? modelHint.toLowerCase(Locale.US) : "";
        boolean isLlama3 = lowerModel.contains("llama-3") || lowerModel.contains("llama3");
        boolean isGemma = lowerModel.contains("gemma");

        String sys = (systemPrompt != null && !systemPrompt.trim().isEmpty())
                ? systemPrompt.trim()
                : "You are Onyx AI, a helpful, concise, and accurate on-device personal assistant.";

        StringBuilder sb = new StringBuilder();

        if (isLlama3) {
            sb.append("<|begin_of_text|>");
            sb.append("<|start_header_id|>system<|end_header_id|>\n\n")
              .append(sys)
              .append("<|eot_id|>");

            if (messages != null && messages.length() > 0) {
                for (int i = 0; i < messages.length(); i++) {
                    try {
                        JSONObject msg = messages.getJSONObject(i);
                        String role = msg.optString("role", "user");
                        String content = msg.optString("content", "").trim();
                        if (content.isEmpty()) continue;
                        if (!"user".equals(role) && !"assistant".equals(role)) {
                            role = "user";
                        }
                        sb.append("<|start_header_id|>").append(role).append("<|end_header_id|>\n\n")
                          .append(content)
                          .append("<|eot_id|>");
                    } catch (JSONException ignored) {
                        // Skip malformed message
                    }
                }
            } else if (rawPrompt != null && !rawPrompt.trim().isEmpty()) {
                sb.append("<|start_header_id|>user<|end_header_id|>\n\n")
                  .append(rawPrompt.trim())
                  .append("<|eot_id|>");
            }

            sb.append("<|start_header_id|>assistant<|end_header_id|>\n\n");
            return sb.toString();
        }

        if (isGemma) {
            boolean injectedSystem = false;
            if (messages != null && messages.length() > 0) {
                for (int i = 0; i < messages.length(); i++) {
                    try {
                        JSONObject msg = messages.getJSONObject(i);
                        String role = msg.optString("role", "user");
                        String content = msg.optString("content", "").trim();
                        if (content.isEmpty()) continue;
                        String gemmaRole = "assistant".equals(role) ? "model" : "user";
                        sb.append("<start_of_turn>").append(gemmaRole).append("\n");
                        if (!injectedSystem && "user".equals(gemmaRole)) {
                            sb.append(sys).append("\n\n");
                            injectedSystem = true;
                        }
                        sb.append(content).append("<end_of_turn>\n");
                    } catch (JSONException ignored) {
                        // Skip malformed message
                    }
                }
            } else if (rawPrompt != null && !rawPrompt.trim().isEmpty()) {
                sb.append("<start_of_turn>user\n")
                  .append(sys).append("\n\n")
                  .append(rawPrompt.trim())
                  .append("<end_of_turn>\n");
            }
            sb.append("<start_of_turn>model\n");
            return sb.toString();
        }

        // Default ChatML template (Qwen2.5, Dolphin, Phi-3.5, Mistral/ChatML)
        sb.append("<|im_start|>system\n").append(sys).append("<|im_end|>\n");
        if (messages != null && messages.length() > 0) {
            for (int i = 0; i < messages.length(); i++) {
                try {
                    JSONObject msg = messages.getJSONObject(i);
                    String role = msg.optString("role", "user");
                    String content = msg.optString("content", "").trim();
                    if (content.isEmpty()) continue;
                    if (!"user".equals(role) && !"assistant".equals(role)) {
                        role = "user";
                    }
                    sb.append("<|im_start|>").append(role).append("\n")
                      .append(content)
                      .append("<|im_end|>\n");
                } catch (JSONException ignored) {
                    // Skip malformed message
                }
            }
        } else if (rawPrompt != null && !rawPrompt.trim().isEmpty()) {
            sb.append("<|im_start|>user\n")
              .append(rawPrompt.trim())
              .append("<|im_end|>\n");
        }
        sb.append("<|im_start|>assistant\n");
        return sb.toString();
    }

    @PluginMethod
    public void generate(PluginCall call) {
        if (!nativeLibraryLoaded) {
            call.reject("Native llama.cpp engine is unavailable");
            return;
        }
        if (loadedModelFileName == null) {
            call.reject("No local GGUF model is currently loaded");
            return;
        }
        if (!isGenerating.compareAndSet(false, true)) {
            call.reject("Local inference is already running");
            return;
        }

        String requestId = call.getString("requestId", String.valueOf(System.currentTimeMillis()));
        String systemPrompt = call.getString("systemPrompt", "");
        String rawPrompt = call.getString("prompt", "");
        JSArray messages = call.getArray("messages");
        float temperature = call.getFloat("temperature", 0.7f);
        int maxTokens = call.getInt("maxTokens", 1024);

        String formattedPrompt = formatConversationPrompt(
                loadedModelFileName,
                systemPrompt,
                messages,
                rawPrompt
        );

        inferenceExecutor.execute(() -> {
            StringBuilder fullText = new StringBuilder();
            long startedAt = System.currentTimeMillis();

            try {
                int tokenCount = nativeGenerate(
                        formattedPrompt,
                        temperature,
                        maxTokens,
                        token -> {
                            if (token == null || token.isEmpty()) {
                                return;
                            }
                            fullText.append(token);
                            JSObject tokenEvent = new JSObject();
                            tokenEvent.put("requestId", requestId);
                            tokenEvent.put("token", token);
                            notifyListeners("onToken", tokenEvent);
                        }
                );

                if (tokenCount < 0) {
                    String errMsg = tokenCount == -5
                            ? "Insufficient device RAM during local inference"
                            : "Local model generation failed (code " + tokenCount + ")";
                    JSObject errEvent = new JSObject();
                    errEvent.put("requestId", requestId);
                    errEvent.put("message", errMsg);
                    notifyListeners("onError", errEvent);
                    call.reject(errMsg);
                    return;
                }

                long elapsedMs = Math.max(1L, System.currentTimeMillis() - startedAt);
                double tokensPerSec = (tokenCount * 1000.0) / elapsedMs;

                JSObject doneEvent = new JSObject();
                doneEvent.put("requestId", requestId);
                doneEvent.put("text", fullText.toString().trim());
                doneEvent.put("tokensGenerated", tokenCount);
                doneEvent.put("tokensPerSecond", Math.round(tokensPerSec * 10.0) / 10.0);
                doneEvent.put("modelFileName", loadedModelFileName);
                notifyListeners("onComplete", doneEvent);

                call.resolve(doneEvent);
            } catch (Exception ex) {
                Log.e(TAG, "Error during native generation", ex);
                JSObject errEvent = new JSObject();
                errEvent.put("requestId", requestId);
                errEvent.put("message", ex.getMessage() != null ? ex.getMessage() : "Local inference error");
                notifyListeners("onError", errEvent);
                call.reject("Local inference error: " + ex.getMessage());
            } finally {
                isGenerating.set(false);
            }
        });
    }

    @PluginMethod
    public void stopGeneration(PluginCall call) {
        if (nativeLibraryLoaded) {
            nativeStopGeneration();
        }
        JSObject res = new JSObject();
        res.put("stopped", true);
        call.resolve(res);
    }

    @PluginMethod
    public void unloadModel(PluginCall call) {
        inferenceExecutor.execute(() -> {
            if (nativeLibraryLoaded) {
                nativeStopGeneration();
                nativeUnloadModel();
            }
            loadedModelFileName = null;
            JSObject res = new JSObject();
            res.put("unloaded", true);
            call.resolve(res);
        });
    }

    @Override
    protected void handleOnDestroy() {
        for (DownloadControl control : activeDownloads.values()) {
            control.paused.set(true);
        }
        activeDownloads.clear();
        if (nativeLibraryLoaded) {
            nativeStopGeneration();
            nativeUnloadModel();
        }
        loadedModelFileName = null;
        downloadExecutor.shutdownNow();
        inferenceExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void importModelFromFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(call, intent, "handleImportFileResult");
    }

    @ActivityCallback
    private void handleImportFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("File selection cancelled.");
            return;
        }
        Uri uri = result.getData().getData();
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                String rawName = "custom_model_" + System.currentTimeMillis() + ".gguf";
                try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (nameIdx >= 0) {
                            String found = cursor.getString(nameIdx);
                            if (found != null && !found.trim().isEmpty()) rawName = found.trim();
                        }
                    }
                }
                if (!rawName.toLowerCase(Locale.ROOT).endsWith(".gguf")) {
                    call.reject("Please select a valid .gguf model file.");
                    return;
                }
                String safeName = rawName.replaceAll("[^a-zA-Z0-9._-]", "_");
                if (!safeName.toLowerCase(Locale.ROOT).endsWith(".gguf")) safeName = safeName + ".gguf";
                File outFile = new File(getModelsDir(), safeName);
                long copied = 0L;
                try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                     FileOutputStream out = new FileOutputStream(outFile)) {
                    if (in == null) {
                        call.reject("Cannot read selected file.");
                        return;
                    }
                    byte[] buf = new byte[DOWNLOAD_BUFFER_SIZE];
                    int read;
                    while ((read = in.read(buf)) != -1) {
                        out.write(buf, 0, read);
                        copied += read;
                    }
                    out.flush();
                }
                JSObject res = new JSObject();
                res.put("imported", true);
                res.put("fileName", safeName);
                res.put("sizeBytes", copied);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Import failed: " + e.getMessage());
            }
        });
    }

}
