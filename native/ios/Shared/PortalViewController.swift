import UIKit
import WebKit

/// Native Swift shell for Customer, Admin, Staff and Support.
/// Live name and logo come from `/api/mobile/feed` — no App Store release.
final class PortalViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let webView: WKWebView = {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.allowsInlineMediaPlayback = true
        return WKWebView(frame: .zero, configuration: config)
    }()

    private let brand = UILabel()
    private let logo = UIImageView()
    private let bar = UIStackView()
    private let progress = UIProgressView(progressViewStyle: .bar)
    private var progressObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.12, blue: 0.23, alpha: 1)
        configureChrome()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        if let url = BrandingService.startURL {
            webView.load(URLRequest(url: url))
        }
        BrandingService.load { [weak self] brand in
            self?.brand.text = brand.name
            if let image = brand.logo { self?.logo.image = image }
        }
        progressObservation = webView.observe(\.estimatedProgress, options: .new) { [weak self] view, _ in
            self?.progress.setProgress(Float(view.estimatedProgress), animated: true)
            self?.progress.isHidden = view.estimatedProgress >= 1
        }
    }

    private func configureChrome() {
        brand.textColor = UIColor(red: 0.97, green: 0.95, blue: 0.92, alpha: 1)
        brand.font = .boldSystemFont(ofSize: 16)
        brand.text = BrandingService.fallbackName
        logo.contentMode = .scaleAspectFit
        logo.backgroundColor = UIColor(red: 0.97, green: 0.95, blue: 0.92, alpha: 1)
        logo.layer.cornerRadius = 16
        logo.clipsToBounds = true
        bar.axis = .horizontal
        bar.alignment = .center
        bar.spacing = 10
        bar.isLayoutMarginsRelativeArrangement = true
        bar.layoutMargins = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
        bar.backgroundColor = UIColor(red: 0.04, green: 0.12, blue: 0.23, alpha: 1)
        bar.addArrangedSubview(logo)
        bar.addArrangedSubview(brand)
        progress.progressTintColor = UIColor(red: 0.77, green: 0.58, blue: 0.29, alpha: 1)
        progress.trackTintColor = UIColor(red: 0.04, green: 0.12, blue: 0.23, alpha: 1)
        [bar, progress, webView].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.heightAnchor.constraint(equalToConstant: 56),
            logo.widthAnchor.constraint(equalToConstant: 32),
            logo.heightAnchor.constraint(equalToConstant: 32),
            progress.topAnchor.constraint(equalTo: bar.bottomAnchor),
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progress.heightAnchor.constraint(equalToConstant: 2),
            webView.topAnchor.constraint(equalTo: progress.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, let scheme = url.scheme, !["http", "https", "about", "blob"].contains(scheme) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            webView.load(URLRequest(url: url))
        }
        return nil
    }
}
