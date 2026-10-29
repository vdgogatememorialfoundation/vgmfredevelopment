import UIKit
import WebKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = PortalViewController()
        window?.makeKeyAndVisible()
        return true
    }
}

/// One Swift shell for Customer / Admin / Staff / Support.
/// Set `VGMF_FLAVOR` and `START_PATH` in each Xcode target Info tab.
/// Live name and logo come from `/api/mobile/feed` — no App Store release.
final class PortalViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let webView = WKWebView(frame: .zero, configuration: {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.javaScriptEnabled = true
        return config
    }())
    private let brand = UILabel()
    private let logo = UIImageView()
    private let origin = "https://vaidyagogate.org"
    private var flavor: String { Bundle.main.object(forInfoDictionaryKey: "VGMF_FLAVOR") as? String ?? "customer" }
    private var startPath: String { Bundle.main.object(forInfoDictionaryKey: "START_PATH") as? String ?? "/" }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.97, green: 0.95, blue: 0.92, alpha: 1)
        brand.textColor = .white
        brand.font = .boldSystemFont(ofSize: 16)
        brand.text = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "VGMF"
        logo.contentMode = .scaleAspectFit
        let bar = UIStackView(arrangedSubviews: [logo, brand])
        bar.axis = .horizontal
        bar.alignment = .center
        bar.spacing = 10
        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.isLayoutMarginsRelativeArrangement = true
        bar.layoutMargins = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
        bar.backgroundColor = UIColor(red: 0.04, green: 0.12, blue: 0.23, alpha: 1)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        logo.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bar)
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.heightAnchor.constraint(equalToConstant: 52),
            logo.widthAnchor.constraint(equalToConstant: 28),
            logo.heightAnchor.constraint(equalToConstant: 28),
            webView.topAnchor.constraint(equalTo: bar.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        if let url = URL(string: origin + startPath) {
            webView.load(URLRequest(url: url))
        }
        refreshBranding()
    }

    private func refreshBranding() {
        guard let url = URL(string: "\(origin)/api/mobile/feed") else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            let feed = (json["feed"] as? [String: Any]) ?? json
            let apps = ((feed["mobile"] as? [String: Any])?["apps"] as? [String: Any]) ?? [:]
            let brandInfo = apps[self.flavor] as? [String: Any]
            let name = (brandInfo?["name"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            DispatchQueue.main.async { if let name, !name.isEmpty { self.brand.text = name } }
        }.resume()
    }
}
