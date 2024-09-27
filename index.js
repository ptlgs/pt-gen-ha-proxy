const http = require('http');
const url = require('url');
const fs = require('fs');
const axios = require('axios');

// Read configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const upstreamUrls = config.urls;

// Initialize cache
const cache = new Map();

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCacheKey(req) {
    return `${req.method}:${req.url}`;
}

function isCacheValid(cacheEntry) {
    const now = Date.now();
    return now - cacheEntry.timestamp < 24 * 60 * 60 * 1000; // 24 hours
}

function getTimestamp() {
    return new Date().toISOString();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function makeRequest(upstreamUrl, clientReq, retries = 5) {
    const cacheKey = getCacheKey(clientReq);

    // Build the full URL
    const parsedClientUrl = url.parse(clientReq.url);
    const fullUrl = url.resolve(upstreamUrl, parsedClientUrl.path);

    // Build the request options
    let options = {
        method: clientReq.method,
        url: fullUrl,
        headers: {
            ...clientReq.headers,
            host: url.parse(fullUrl).host,
        },
        responseType: 'arraybuffer', // Receive response data as a Buffer
        validateStatus: null, // Do not throw on non-2xx status codes
    };

    try {
        console.log(`[${getTimestamp()}] Sending request to ${fullUrl}`);
        const response = await axios(options);

        const responseData = {
            statusCode: response.status,
            headers: response.headers,
            body: response.data,
        };

        if (response.status < 400) {
            if (response.status === 200) {
                // Cache successful responses
                cache.set(cacheKey, {
                    response: responseData,
                    timestamp: Date.now(),
                });
                console.log(`[${getTimestamp()}] Cached response for ${cacheKey}`);
            }
            console.log(`[${getTimestamp()}] Successful response from ${fullUrl} with status ${response.status}`);
            return responseData;
        } else {
            throw new Error(`${fullUrl} gave status code ${response.status}; response body=${response.data}`);
        }
    } catch (error) {
        console.log(`[${getTimestamp()}] Error occurred: ${error.message}`);
        if (retries > 0) {
            console.log(
                `[${getTimestamp()}] Retrying ${fullUrl}, attempts left: ${retries - 1}`
            );
            await wait(3000 * Math.random());
            return await makeRequest(upstreamUrl, clientReq, retries - 1);
        } else {
            throw error;
        }
    }
}

function makeConcurrentRequests(clientReq) {
    const MAX_CONCURRENT_REQUESTS = 5;
    let selectedUrls = upstreamUrls;

    if (selectedUrls.length > MAX_CONCURRENT_REQUESTS) {
        selectedUrls = shuffleArray([...selectedUrls]).slice(0, MAX_CONCURRENT_REQUESTS);
    }

    console.log(`[${getTimestamp()}] Making concurrent requests to ${selectedUrls.length} upstream URLs`);
    return Promise.any(selectedUrls.map((url) => makeRequest(url, clientReq)));
}


async function getResponse(clientReq) {
    const cacheKey = getCacheKey(clientReq);
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse && isCacheValid(cachedResponse)) {
        console.log(`[${getTimestamp()}] Cache hit for ${cacheKey}`);
        return cachedResponse.response;
    } else {
        cache.delete(cacheKey);
    }


    return await makeConcurrentRequests(clientReq);
}

const server = http.createServer(async (clientReq, clientRes) => {
    console.log(`[${getTimestamp()}] Received request: ${clientReq.method} ${clientReq.url}`);
    try {
        const proxyRes = await getResponse(clientReq);

        // Forward the headers
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
            clientRes.setHeader(key, value);
        });

        clientRes.writeHead(proxyRes.statusCode);
        clientRes.end(proxyRes.body);
        console.log(`[${getTimestamp()}] Sent response to client with status ${proxyRes.statusCode}`);
    } catch (error) {
        console.error(`[${getTimestamp()}] Error handling request: ${error.message}`);
        clientRes.writeHead(500, {'Content-Type': 'text/plain'});
        clientRes.end('Error: ' + error.message);
    }
});

const PORT = process.env.PORT || 15967;
server.listen(PORT, () => {
    console.log(`[${getTimestamp()}] Server running on port ${PORT}`);
});
