class Blink < Formula
  desc "Command-line interface for Blink spatial notes"
  homepage "https://blink.arach.dev/"
  url "https://github.com/@@REPO@@/releases/download/v@@VERSION@@/blink-macos-arm64"
  sha256 "@@CLI_SHA256@@"
  license "MIT"

  depends_on arch: :arm64
  depends_on macos: :sonoma

  def install
    chmod 0755, "blink-macos-arm64"
    bin.install "blink-macos-arm64" => "blink"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/blink --version")
  end
end
