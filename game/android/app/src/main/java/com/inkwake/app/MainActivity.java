package com.inkwake.app;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Hosts the game full-screen. Everything the player sees is the web build in a WebView;
 * this class only makes that feel like an app: no system bars, screen kept awake,
 * content kept clear of a camera cutout, and the Back button routed to the game.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        final WebView web = getBridge().getWebView();
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        // The layout is designed in CSS pixels; do not let the system font-size setting stretch it.
        web.getSettings().setTextZoom(100);

        // Pad the content away from a notch or punch-hole instead of drawing under it.
        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets cut = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            v.setPadding(cut.left, cut.top, cut.right, cut.bottom);
            return insets;
        });

        // Back pauses the game or steps back through a menu. Only from the title does it leave the app.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                web.evaluateJavascript("(window.__inkwakeBack ? window.__inkwakeBack() : false)", handled -> {
                    if (!"true".equals(handled)) moveTaskToBack(true);
                });
            }
        });

        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.systemBars());
    }
}
