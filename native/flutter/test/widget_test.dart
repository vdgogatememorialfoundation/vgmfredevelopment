import "package:flutter_test/flutter_test.dart";
import "package:vgmf/flavor.dart";

void main() {
  test("flavors map to portal start paths", () {
    expect(Flavor.current().id, isNotEmpty);
    expect(const Flavor(id: "admin", displayName: "VGMF Admin", startPath: "/admin").startPath, "/admin");
  });
}
