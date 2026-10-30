import "package:file_picker/file_picker.dart";
import "package:flutter/material.dart";
import "package:webview_flutter/webview_flutter.dart";
import "package:webview_flutter_android/webview_flutter_android.dart";

import "branding.dart";
import "flavor.dart";

class PortalPage extends StatefulWidget {
  const PortalPage({super.key, required this.flavor});

  final Flavor flavor;

  @override
  State<PortalPage> createState() => _PortalPageState();
}

class _PortalPageState extends State<PortalPage> {
  late final WebViewController _controller;
  Branding? _branding;
  var _progress = 0;
  var _canGoBack = false;

  String get _origin => siteUrl.replaceAll(RegExp(r"/$"), "");
  String get _start => "$_origin${widget.flavor.startPath}";

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFF7F3EA))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (value) => setState(() => _progress = value),
          onPageFinished: (_) async {
            final back = await _controller.canGoBack();
            if (mounted) setState(() => _canGoBack = back);
          },
        ),
      )
      ..loadRequest(Uri.parse(_start));
    _enableFilePicker();
    _refreshBranding();
  }

  Future<void> _enableFilePicker() async {
    final platform = _controller.platform;
    if (platform is AndroidWebViewController) {
      await platform.setOnShowFileSelector((params) async {
        final result = await FilePicker.platform.pickFiles(
          allowMultiple: params.mode == FileSelectorMode.openMultiple,
          type: FileType.any,
        );
        return [
          for (final file in result?.files ?? const <PlatformFile>[])
            if (file.path != null) Uri.file(file.path!).toString(),
        ];
      });
    }
  }

  Future<void> _refreshBranding() async {
    try {
      final next = await Branding.fetch(widget.flavor);
      if (mounted) setState(() => _branding = next);
    } catch (_) {
      /* keep compiled name until the next launch */
    }
  }

  Future<void> _handleBack() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = _branding?.name ?? widget.flavor.displayName;
    final logo = _branding?.logoBytes;
    return PopScope(
      canPop: !_canGoBack,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF0B1F3A),
        body: SafeArea(
          child: Column(
            children: [
              Material(
                color: const Color(0xFF0B1F3A),
                child: SizedBox(
                  height: 56,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: const Color(0xFFF7F3EA),
                          backgroundImage: logo == null ? null : MemoryImage(logo),
                          child: logo == null
                              ? Text(
                                  (title.isEmpty ? "V" : title.substring(0, 1)).toUpperCase(),
                                  style: const TextStyle(
                                    color: Color(0xFF0B1F3A),
                                    fontWeight: FontWeight.w700,
                                  ),
                                )
                              : null,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFFF7F3EA),
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: "Refresh branding",
                          onPressed: _refreshBranding,
                          icon: const Icon(Icons.refresh, color: Color(0xFFF7F3EA)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (_progress > 0 && _progress < 100)
                LinearProgressIndicator(
                  value: _progress / 100,
                  minHeight: 2,
                  color: const Color(0xFFC4954A),
                  backgroundColor: const Color(0xFF0B1F3A),
                ),
              Expanded(child: WebViewWidget(controller: _controller)),
            ],
          ),
        ),
      ),
    );
  }
}
