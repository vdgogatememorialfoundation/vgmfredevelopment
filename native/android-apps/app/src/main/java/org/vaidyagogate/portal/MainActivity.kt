package org.vaidyagogate.portal

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var titleView: TextView
    private lateinit var logoView: ImageView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val io = Executors.newSingleThreadExecutor()

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uris = if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { arrayOf(it) } ?: result.data?.clipData?.let { clip ->
                Array(clip.itemCount) { index -> clip.getItemAt(index).uri }
            }
        } else null
        fileCallback?.onReceiveValue(uris)
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        titleView = findViewById(R.id.titleView)
        logoView = findViewById(R.id.logoView)
        webView = findViewById(R.id.webView)

        val fallbackName = getString(R.string.app_name)
        titleView.text = fallbackName
        title = fallbackName

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.loadsImagesAutomatically = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.allowFileAccess = true
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url ?: return false
                if (url.scheme == "http" || url.scheme == "https") {
                    view.loadUrl(url.toString())
                    return true
                }
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                } catch (_: Exception) {
                    false
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val intent = params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "image/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                return try {
                    filePicker.launch(intent)
                    true
                } catch (_: Exception) {
                    fileCallback = null
                    false
                }
            }
        }

        val origin = BuildConfig.SITE_URL.trimEnd('/')
        webView.loadUrl(origin + BuildConfig.START_PATH)
        refreshBranding(origin)
    }

    private fun refreshBranding(origin: String) {
        io.execute {
            try {
                val connection = URL("$origin/api/mobile/feed?t=${System.currentTimeMillis()}").openConnection() as HttpURLConnection
                connection.connectTimeout = 8000
                connection.readTimeout = 8000
                connection.setRequestProperty("Accept", "application/json")
                val text = connection.inputStream.bufferedReader().use { it.readText() }
                val root = JSONObject(text)
                val feed = if (root.has("feed")) root.getJSONObject("feed") else root
                val mobile = feed.optJSONObject("mobile") ?: JSONObject()
                val apps = mobile.optJSONObject("apps") ?: JSONObject()
                val brand = apps.optJSONObject(BuildConfig.VGMF_FLAVOR) ?: JSONObject()
                val site = feed.optJSONObject("site") ?: JSONObject()
                val name = brand.optString("name").ifBlank { site.optString("name").ifBlank { getString(R.string.app_name) } }
                val logo = brand.optString("logoUrl").ifBlank { site.optString("logoUrl") }
                val bitmap = decodeLogo(logo)
                runOnUiThread {
                    titleView.text = name
                    title = name
                    if (bitmap != null) logoView.setImageBitmap(bitmap)
                }
            } catch (_: Exception) {
                /* keep compiled name until the next launch */
            }
        }
    }

    private fun decodeLogo(value: String): Bitmap? {
        if (value.isBlank()) return null
        return try {
            if (value.startsWith("data:image")) {
                val comma = value.indexOf(',')
                if (comma < 0) return null
                val bytes = Base64.decode(value.substring(comma + 1), Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            } else {
                val connection = URL(value).openConnection() as HttpURLConnection
                connection.connectTimeout = 8000
                connection.readTimeout = 8000
                connection.inputStream.use { BitmapFactory.decodeStream(it) }
            }
        } catch (_: Exception) {
            null
        }
    }

    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }
}
