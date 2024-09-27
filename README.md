# pt-gen-ha-proxy

pt-gen-ha-proxy is a high availability proxy server for the pt-gen program deployed on Cloudflare Workers. It ensures continuous service and improved performance by distributing requests across multiple pt-gen instances.

## Features

- Concurrent requests to multiple pt-gen instances
- Returns the first successful response
- Automatic retry mechanism (up to 3 attempts per instance)
- Configurable instance list via `config.json`

## Prerequisites

- Node.js (v12.0.0 or higher recommended)

## Running with Docker

```
docker run --name pt-gen-ha-proxy --network host ghcr.io/ptlgs/pt-gen-ha-proxy:main
```

## Installation

1. Clone the repository or download the source code:
   ```
   git clone https://github.com/ptlgs/pt-gen-ha-proxy.git
   cd pt-gen-ha-proxy
   ```

2. Install dependencies (if any are added in the future):
   ```
   npm install
   ```

## Configuration

Create a `config.json` file in the project root directory with the following structure:

```json
{
  "urls": [
    "https://pt-gen-instance1.workers.dev",
    "https://pt-gen-instance2.workers.dev",
    "https://pt-gen-instance3.workers.dev"
  ]
}
```

Replace the URLs with your actual pt-gen Cloudflare Worker instances.

## Usage

To start the server:

```
node index.js
```

## How It Works

1. When a request is received, pt-gen-ha-proxy concurrently sends requests to all configured pt-gen instances.
2. The first successful (HTTP 200) response is returned to the client.
3. If an instance fails to respond, the proxy will retry the request up to 3 times for that instance.
4. If all instances fail after retries, an error is returned to the client.

## License

[MIT License](LICENSE)
