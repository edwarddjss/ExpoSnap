# Changelog

## 3.0.0

The agent can now drive the app, not only look at screenshots you took.

### Added

- `take_screenshot`: the agent captures the app on demand, on a phone, simulator or browser.
- `get_logs`: console output and uncaught errors from the app, filterable by level, text and time.
- `open_url`: opens an Expo Router path or a deep link. Pass `navigate` to the wrapper for paths in development builds.
- `reload_app`, `get_app_status`, `get_screenshot`.
- MCP resources for screenshots (`exposnap://screenshots/{id}`) and logs (`exposnap://logs`), with list-changed notifications.
- A `review_screen` prompt.
- Uncaught app errors are sent to the MCP client as logging notifications.
- Expo web support for capture.
- `serverUrl` and `port` props for tunnel mode and custom ports.

### Changed

- Built on the current MCP SDK API (`McpServer`, `registerTool` with zod input and output schemas, tool annotations).
- The app finds the server from Metro's address in one round of requests, instead of scanning up to 1,270 addresses across five guessed subnets.
- The wrapper does nothing in release builds unless `enabled` is passed.
- Screenshots are stored in the system temp folder (`EXPOSNAP_DIR`), not inside the npx cache, and keep their notes across restarts.
- Captures are sized for vision models (1568px on the long edge by default).
- `react-native-view-shot` is a peer dependency.
- Express and multer are gone; the server uses Node's own HTTP. The package is 24 KB instead of 1 MB.

### Fixed

- Resource handlers existed but were never registered.
- JPEG screenshots were labelled as PNG.
- Uploads had no size limit.
- The camera button could swallow taps and relied on private Animated internals.

### Compatibility

- Apps on the 2.x wrapper keep working with the 3.0 server.
- `discoverServer` and `getServerURL` are still exported.
