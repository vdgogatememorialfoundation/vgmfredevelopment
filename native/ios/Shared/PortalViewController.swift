import UIKit

/// Native Swift app for Customer, Admin, Staff and Support. Content comes from `/api/mobile/feed`.
final class PortalViewController: UITabBarController {
    private var feed: [String: Any] = [:]
    private var brand = AppBrand(name: Flavor.fallbackName, logo: nil)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.97, green: 0.95, blue: 0.92, alpha: 1)
        tabBar.tintColor = UIColor(red: 0.56, green: 0.18, blue: 0.18, alpha: 1)
        rebuild()
        Task { await refresh() }
    }

    @MainActor
    func refresh() async {
        do {
            feed = try await FeedClient.loadFeed()
            brand = FeedClient.brand(from: feed)
            let apps = ((feed["mobile"] as? [String: Any])?["apps"] as? [String: Any]) ?? [:]
            let branded = apps[Flavor.id] as? [String: Any] ?? [:]
            let logoValue = FeedClient.text(branded["logoUrl"]).isEmpty ? FeedClient.text(site()["logoUrl"]) : FeedClient.text(branded["logoUrl"])
            if let image = await FeedClient.loadLogo(logoValue) { brand.logo = image }
            rebuild()
        } catch {
            presentNote(error.localizedDescription)
        }
    }

    private func moduleOn(_ id: String) -> Bool {
        if let visibility = feed["visibility"] as? [String: Any], visibility[id] as? Bool == false { return false }
        if let modules = (feed["mobile"] as? [String: Any])?["modules"] as? [String: Any], modules[id] as? Bool == false { return false }
        return true
    }

    private func rebuild() {
        viewControllers = Flavor.tabs.filter { moduleOn($0.id) }.map { tab in
            let list = FeedScreenController(tab: tab.id, title: tab.title, shell: self)
            let nav = UINavigationController(rootViewController: list)
            nav.navigationBar.prefersLargeTitles = false
            nav.tabBarItem = UITabBarItem(title: tab.title, image: UIImage(systemName: tab.system), tag: 0)
            return nav
        }
    }

    func list(_ key: String) -> [[String: Any]] {
        (feed[key] as? [Any] ?? []).compactMap { $0 as? [String: Any] }
    }

    func site() -> [String: Any] { feed["site"] as? [String: Any] ?? [:] }
    func about() -> [String: Any] { feed["about"] as? [String: Any] ?? [:] }
    func appName() -> String { brand.name }
    func logo() -> UIImage? { brand.logo }
    func presentNote(_ text: String) {
        let alert = UIAlertController(title: nil, message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

final class FeedScreenController: UITableViewController {
    private let tab: String
    private weak var shell: PortalViewController?
    private var selected: [String: Any]?
    private var screen: String
    private var certResult = ""

    init(tab: String, title: String, shell: PortalViewController) {
        self.tab = tab
        self.screen = tab
        self.shell = shell
        super.init(style: .insetGrouped)
        self.title = title
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
        refreshControl = UIRefreshControl()
        refreshControl?.addTarget(self, action: #selector(pull), for: .valueChanged)
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .refresh, target: self, action: #selector(pull))
    }

    @objc private func pull() {
        Task {
            await shell?.refresh()
            await MainActor.run {
                tableView.reloadData()
                refreshControl?.endRefreshing()
            }
        }
    }

    private func rows() -> [[String: Any]] {
        switch screen {
        case "events": return shell?.list("events") ?? []
        case "shop": return shell?.list("books") ?? []
        case "clinics": return shell?.list("clinics") ?? []
        case "articles": return shell?.list("articles") ?? []
        case "videos": return shell?.list("videos") ?? []
        case "gallery": return shell?.list("gallery") ?? []
        case "notices": return shell?.list("notices") ?? []
        case "home": return homeRows()
        default: return []
        }
    }

    private func homeRows() -> [[String: Any]] {
        var items: [[String: Any]] = [["kind": "hero"]]
        items.append(["kind": "tagline"])
        for item in (shell?.list("announcements") ?? []).prefix(3) {
            var row = item
            row["kind"] = "announce"
            items.append(row)
        }
        items.append(["kind": "explore"])
        for item in (shell?.list("events") ?? []).prefix(3) {
            var row = item
            row["kind"] = "event"
            items.append(row)
        }
        return items
    }

    override func numberOfSections(in tableView: UITableView) -> Int { 1 }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        if ["account", "support", "certificates", "about", "event", "book", "clinic", "article", "cart"].contains(screen) {
            return 1
        }
        let count = rows().count
        return count == 0 ? 1 : count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .subtitle, reuseIdentifier: "cell")
        cell.selectionStyle = .default
        cell.textLabel?.numberOfLines = 0
        cell.detailTextLabel?.numberOfLines = 3
        cell.detailTextLabel?.textColor = UIColor(white: 0.4, alpha: 1)
        if screen == "home" {
            let row = rows()[indexPath.row]
            switch FeedClient.text(row["kind"]) {
            case "hero":
                cell.textLabel?.text = shell?.appName()
                cell.detailTextLabel?.text = "Live from the Foundation website"
                cell.imageView?.image = shell?.logo() ?? UIImage(named: "AppIcon")
            case "tagline":
                cell.textLabel?.font = .preferredFont(forTextStyle: .title2)
                cell.textLabel?.text = FeedClient.text(shell?.site()["tagline"], "Preserving Ayurveda. Advancing knowledge.")
            case "announce":
                cell.textLabel?.text = FeedClient.text(row["title"])
                cell.detailTextLabel?.text = FeedClient.text(row["description"])
            case "explore":
                cell.textLabel?.text = "Explore articles, videos, gallery, notices, about, support and certificates"
            case "event":
                cell.textLabel?.text = FeedClient.text(row["name"])
                cell.detailTextLabel?.text = FeedClient.text(row["shortDescription"], FeedClient.text(row["city"]))
            default:
                cell.textLabel?.text = FeedClient.text(row["title"], FeedClient.text(row["name"]))
            }
            return cell
        }
        if screen == "about" {
            let about = shell?.about() ?? [:]
            cell.textLabel?.text = FeedClient.text(about["title"], "About the Foundation")
            cell.detailTextLabel?.text = FeedClient.text(about["intro"])
            cell.selectionStyle = .none
            return cell
        }
        if screen == "account" {
            if let token = FeedClient.token, !token.isEmpty {
                cell.textLabel?.text = FeedClient.name.isEmpty ? FeedClient.email : FeedClient.name
                cell.detailTextLabel?.text = "Signed in. Pull to refresh, or tap to sign out."
            } else {
                cell.textLabel?.text = "Email sign-in"
                cell.detailTextLabel?.text = "Tap to receive a 6-digit email code."
            }
            return cell
        }
        if screen == "support" {
            cell.textLabel?.text = "Open a support ticket"
            cell.detailTextLabel?.text = "Tap to send a message to the Foundation."
            return cell
        }
        if screen == "certificates" {
            cell.textLabel?.text = certResult.isEmpty ? "Verify a certificate" : certResult
            cell.detailTextLabel?.text = "Tap to enter a certificate number."
            return cell
        }
        if let selected, ["event", "book", "clinic", "article"].contains(screen) {
            cell.textLabel?.text = FeedClient.text(selected["name"], FeedClient.text(selected["title"]))
            cell.detailTextLabel?.text = FeedClient.text(selected["shortDescription"], FeedClient.text(selected["description"], FeedClient.text(selected["excerpt"])))
            cell.selectionStyle = .none
            return cell
        }
        let items = rows()
        if items.isEmpty {
            cell.textLabel?.text = "Nothing published yet"
            cell.detailTextLabel?.text = "This list fills after Admin publishes the live site."
            cell.selectionStyle = .none
            return cell
        }
        let item = items[indexPath.row]
        cell.textLabel?.text = FeedClient.text(item["name"], FeedClient.text(item["title"]))
        cell.detailTextLabel?.text = FeedClient.text(item["city"], FeedClient.text(item["excerpt"], FeedClient.text(item["description"], FeedClient.text(item["author"]))))
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        if screen == "home" {
            let row = rows()[indexPath.row]
            switch FeedClient.text(row["kind"]) {
            case "explore":
                let sheet = UIAlertController(title: "Explore", message: nil, preferredStyle: .actionSheet)
                for item in [("articles", "Articles"), ("videos", "Videos"), ("gallery", "Gallery"), ("notices", "Notices"), ("about", "About"), ("support", "Support"), ("certificates", "Certificates")] {
                    sheet.addAction(UIAlertAction(title: item.1, style: .default) { _ in
                        self.screen = item.0
                        self.title = item.1
                        self.tableView.reloadData()
                    })
                }
                sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel))
                present(sheet, animated: true)
            case "event", "announce":
                selected = row
                screen = FeedClient.text(row["kind"]) == "event" ? "event" : screen
                title = FeedClient.text(row["name"], FeedClient.text(row["title"]))
                tableView.reloadData()
            default:
                break
            }
            return
        }
        if screen == "account" { presentAccount(); return }
        if screen == "support" { presentTicket(); return }
        if screen == "certificates" { presentCertificate(); return }
        let items = rows()
        guard items.indices.contains(indexPath.row) else { return }
        let item = items[indexPath.row]
        if screen == "videos" {
            let url = FeedClient.text(item["youtubeUrl"], FeedClient.text(item["src"]))
            if let link = URL(string: url) { UIApplication.shared.open(link) }
            return
        }
        selected = item
        if screen == "events" { screen = "event" }
        if screen == "shop" { screen = "book" }
        if screen == "clinics" { screen = "clinic" }
        if screen == "articles" { screen = "article" }
        title = FeedClient.text(item["name"], FeedClient.text(item["title"]))
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "Back", style: .plain, target: self, action: #selector(back))
        tableView.reloadData()
    }

    @objc private func back() {
        screen = tab
        selected = nil
        title = tab.capitalized
        navigationItem.leftBarButtonItem = nil
        tableView.reloadData()
    }

    private func presentAccount() {
        if FeedClient.token != nil {
            FeedClient.token = nil
            shell?.presentNote("Signed out.")
            tableView.reloadData()
            return
        }
        let alert = UIAlertController(title: "Email sign-in", message: "A 6-digit code is sent to your email.", preferredStyle: .alert)
        alert.addTextField { $0.placeholder = "Name" }
        alert.addTextField { $0.placeholder = "Email"; $0.keyboardType = .emailAddress }
        alert.addAction(UIAlertAction(title: "Send code", style: .default) { _ in
            let name = alert.textFields?[0].text ?? ""
            let email = alert.textFields?[1].text ?? ""
            Task {
                _ = try? await FeedClient.post("/api/mobile/otp", body: ["action": "send", "email": email, "name": name])
                await MainActor.run { self.presentVerify(email: email, name: name) }
            }
        })
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        present(alert, animated: true)
    }

    private func presentVerify(email: String, name: String) {
        let alert = UIAlertController(title: "Enter email code", message: email, preferredStyle: .alert)
        alert.addTextField { $0.placeholder = "6-digit code"; $0.keyboardType = .numberPad }
        alert.addAction(UIAlertAction(title: "Verify", style: .default) { _ in
            let code = alert.textFields?[0].text ?? ""
            Task {
                let data = try? await FeedClient.post("/api/mobile/otp", body: ["action": "verify", "email": email, "code": code, "name": name])
                await MainActor.run {
                    if let token = data?["token"] as? String {
                        FeedClient.token = token
                        FeedClient.email = FeedClient.text(data?["email"], email)
                        FeedClient.name = FeedClient.text(data?["name"], name)
                        self.shell?.presentNote("Signed in.")
                        self.tableView.reloadData()
                    } else {
                        self.shell?.presentNote(FeedClient.text(data?["error"], "That code is not valid."))
                    }
                }
            }
        })
        present(alert, animated: true)
    }

    private func presentTicket() {
        let alert = UIAlertController(title: "Support ticket", message: nil, preferredStyle: .alert)
        alert.addTextField { $0.placeholder = "Your name"; $0.text = FeedClient.name }
        alert.addTextField { $0.placeholder = "Email"; $0.text = FeedClient.email }
        alert.addTextField { $0.placeholder = "Subject" }
        alert.addTextField { $0.placeholder = "Message" }
        alert.addAction(UIAlertAction(title: "Send", style: .default) { _ in
            let name = alert.textFields?[0].text ?? ""
            let email = alert.textFields?[1].text ?? ""
            let subject = alert.textFields?[2].text ?? ""
            let body = alert.textFields?[3].text ?? ""
            Task {
                let data = try? await FeedClient.post("/api/mobile/tickets", body: ["name": name, "email": email, "subject": subject, "body": body])
                await MainActor.run {
                    self.shell?.presentNote(data?["ok"] as? Bool == true ? "Ticket opened." : FeedClient.text(data?["error"], "Could not create the ticket."))
                }
            }
        })
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        present(alert, animated: true)
    }

    private func presentCertificate() {
        let alert = UIAlertController(title: "Certificate number", message: nil, preferredStyle: .alert)
        alert.addTextField { $0.placeholder = "Certificate number" }
        alert.addAction(UIAlertAction(title: "Verify", style: .default) { _ in
            let number = alert.textFields?[0].text ?? ""
            Task {
                let data = try? await FeedClient.get("/api/certificates/verify?number=\(number.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? number)")
                await MainActor.run {
                    if data?["verified"] as? Bool == true {
                        let certificate = data?["certificate"] as? [String: Any] ?? [:]
                        self.certResult = "Verified. \(FeedClient.text(certificate["holderName"], FeedClient.text(certificate["name"])))"
                    } else {
                        self.certResult = FeedClient.text(data?["error"], "This certificate could not be verified.")
                    }
                    self.tableView.reloadData()
                }
            }
        })
        present(alert, animated: true)
    }
}
