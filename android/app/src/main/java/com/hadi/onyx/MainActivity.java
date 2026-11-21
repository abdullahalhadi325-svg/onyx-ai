package com.hadi.onyx;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int ONYX_PERMISSIONS_REQUEST_CODE = 1042;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalLLMPlugin.class);
        super.onCreate(savedInstanceState);

        configureWebViewPermissions();
        requestStartupPermissions();
        try {
            ContextCompat.startForegroundService(this, new Intent(this, OnyxBackgroundService.class));
        } catch (Exception ignored) {}
    }

    private void configureWebViewPermissions() {
        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }
        WebView webView = this.bridge.getWebView();
        webView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (request == null) {
                        return;
                    }
                    String[] requested = request.getResources();
                    List<String> granted = new ArrayList<>();
                    for (String resource : requested) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                                || PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            granted.add(resource);
                        }
                    }
                    if (!granted.isEmpty()) {
                        request.grant(granted.toArray(new String[0]));
                    } else {
                        request.deny();
                    }
                });
            }
        });
    }

    private void requestStartupPermissions() {
        List<String> needed = new ArrayList<>();
        addIfMissing(needed, Manifest.permission.CAMERA);
        addIfMissing(needed, Manifest.permission.RECORD_AUDIO);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            addIfMissing(needed, Manifest.permission.READ_MEDIA_IMAGES);
            addIfMissing(needed, Manifest.permission.POST_NOTIFICATIONS);
        } else {
            addIfMissing(needed, Manifest.permission.READ_EXTERNAL_STORAGE);
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(
                    this,
                    needed.toArray(new String[0]),
                    ONYX_PERMISSIONS_REQUEST_CODE
            );
        }
    }

    private void addIfMissing(List<String> target, String permission) {
        if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
            target.add(permission);
        }
    }
}
