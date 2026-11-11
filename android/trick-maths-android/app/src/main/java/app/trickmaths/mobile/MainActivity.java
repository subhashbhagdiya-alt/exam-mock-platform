package app.trickmaths.mobile;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.net.http.SslError;

public final class MainActivity extends Activity {
    private static final String START_URL = "https://trick-table-maths.floot.app/";
    private static final String INTERNAL_HOST = "trick-table-maths.floot.app";
    private static final int PAPER = Color.rgb(248, 247, 240);
    private static final int INK = Color.rgb(23, 61, 62);
    private static final int JADE = Color.rgb(36, 107, 99);
    private static final int MUTED = Color.rgb(103, 119, 113);

    private WebView webView;
    private ProgressBar progressBar;
    private View loadingOverlay;
    private boolean firstLoad = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        buildShell();
        configureServiceWorker();
        configureWebView();
        webView.loadUrl(START_URL);
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(PAPER);
        window.setNavigationBarColor(PAPER);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            );
        }
    }

    private void buildShell() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(PAPER);

        webView = new WebView(this);
        webView.setBackgroundColor(PAPER);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(JADE));
        progressBar.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.TRANSPARENT));
        root.addView(progressBar, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP
        ));

        loadingOverlay = buildLoadingOverlay();
        root.addView(loadingOverlay, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);
    }

    private View buildLoadingOverlay() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(28), dp(28), dp(28));
        panel.setBackgroundColor(PAPER);

        ImageView mark = new ImageView(this);
        mark.setImageResource(R.drawable.ic_brand_mark);
        mark.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        GradientDrawable markBg = new GradientDrawable();
        markBg.setColor(INK);
        markBg.setCornerRadius(dp(24));
        mark.setBackground(markBg);
        mark.setClipToOutline(true);
        LinearLayout.LayoutParams markParams = new LinearLayout.LayoutParams(dp(76), dp(76));
        markParams.bottomMargin = dp(22);
        panel.addView(mark, markParams);

        TextView title = new TextView(this);
        title.setText("Trick Maths");
        title.setTextColor(INK);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        title.setTypeface(Typeface.create("serif", Typeface.BOLD));
        panel.addView(title);

        TextView tagline = new TextView(this);
        tagline.setText("Learn smarter. Calculate faster.");
        tagline.setTextColor(MUTED);
        tagline.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        LinearLayout.LayoutParams taglineParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        taglineParams.topMargin = dp(7);
        panel.addView(tagline, taglineParams);

        ProgressBar spinner = new ProgressBar(this);
        spinner.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(JADE));
        LinearLayout.LayoutParams spinnerParams = new LinearLayout.LayoutParams(dp(30), dp(30));
        spinnerParams.topMargin = dp(30);
        panel.addView(spinner, spinnerParams);

        TextView status = new TextView(this);
        status.setText("Your maths studio is getting ready…");
        status.setTextColor(MUTED);
        status.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        statusParams.topMargin = dp(12);
        panel.addView(status, statusParams);
        return panel;
    }

    private void configureServiceWorker() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return null;
                }
            });
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setTextZoom(100);
        settings.setUserAgentString(settings.getUserAgentString() + " TrickMathsAndroid/1.0.0");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return routeUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return routeUrl(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (firstLoad) {
                    firstLoad = false;
                    loadingOverlay.animate().alpha(0f).setDuration(180).withEndAction(() -> {
                        loadingOverlay.setVisibility(View.GONE);
                        loadingOverlay.setAlpha(1f);
                    }).start();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) showOfflinePage();
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                super.onReceivedHttpError(view, request, response);
                if (request.isForMainFrame() && response.getStatusCode() >= 500) showOfflinePage();
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (ActivityNotFoundException ignored) {
                // No compatible viewer installed.
            }
        });
    }

    private boolean routeUrl(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        if ("https".equals(scheme) && INTERNAL_HOST.equals(host)) return false;

        if ("https".equals(scheme) || "http".equals(scheme)
                || "mailto".equals(scheme) || "tel".equals(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
                // Keep unsupported external schemes from crashing the app.
            }
        }
        return true;
    }

    private void showOfflinePage() {
        if (webView == null) return;
        String html = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<meta name='color-scheme' content='light'><style>"
            + "*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;"
            + "padding:24px;background:#f8f7f0;color:#173d3e;font-family:Arial,sans-serif}"
            + ".card{width:min(100%,390px);padding:30px 24px;border:1px solid #e5e4d9;border-radius:24px;"
            + "background:#fffefa;text-align:center;box-shadow:0 16px 40px rgba(23,61,62,.07)}"
            + ".mark{width:58px;height:58px;margin:0 auto 18px;border-radius:18px;background:#173d3e;"
            + "color:#f8f7f0;display:grid;place-items:center;font-size:27px;font-weight:700}"
            + "h1{font-family:Georgia,serif;font-size:25px;margin:0 0 10px}p{color:#63736d;"
            + "font-size:14px;line-height:1.65;margin:0 0 22px}a{display:inline-block;text-decoration:none;"
            + "background:#246b63;color:white;font-weight:700;padding:13px 22px;border-radius:14px}"
            + "</style></head><body><main class='card'><div class='mark'>T×</div><h1>You're offline</h1>"
            + "<p>Trick Maths needs an internet connection to load the learning studio. Check your network and try again.</p>"
            + "<a href='" + START_URL + "'>Try again</a></main></body></html>";
        webView.loadDataWithBaseURL(START_URL, html, "text/html", "UTF-8", null);
        progressBar.setVisibility(View.GONE);
        if (firstLoad && loadingOverlay != null) loadingOverlay.setVisibility(View.GONE);
        firstLoad = false;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
