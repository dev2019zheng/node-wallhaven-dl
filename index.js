/**
 * Wallhaven Image Downloader
 *
 * API Documentation: https://wallhaven.cc/help/api#wallpapers
 *
 * This script allows users to download wallpapers from Wallhaven.cc using their API.
 * Features:
 * - Download by category (General, Anime, People)
 * - Download by purity level (SFW, Sketchy, NSFW)
 * - Download from latest wallpapers
 * - Download from toplist with various time ranges
 * - Search and download wallpapers
 * - Concurrent downloads with rate limiting
 * - Progress tracking for downloads
 *
 * Usage:
 * 1. Set your API key (get it from https://wallhaven.cc/settings/account)
 * 2. Choose download mode (category/latest/toplist/search)
 * 3. Select filters and options
 * 4. Specify download location and page range
 */

const fs = require("fs");
const https = require("https");
const readline = require("readline");
const path = require("path");

// Constants
const API_KEY =
  process.env.WALLHAVEN_KEY ||
  (() => {
    console.error("Error: WALLHAVEN_KEY environment variable is not set");
    console.error(
      "Please set your Wallhaven API key using: export WALLHAVEN_KEY=your_api_key"
    );
    process.exit(1);
  })();
const BASE_API_URL = `https://wallhaven.cc/api/v1/search`;
const COOKIES = {};

const queryObject = new URLSearchParams({
  apikey: API_KEY,
});

const categories = {
  all: "111",
  anime: "010",
  general: "100",
  people: "001",
  ga: "110",
  gp: "101",
};

const purities = {
  sfw: "100",
  sketchy: "010",
  nsfw: "001",
  ws: "110",
  wn: "101",
  sn: "011",
  all: "111",
};

const valid_ranges = ["1d", "3d", "1w", "1M", "3M", "6M", "1y"];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const CONCURRENCY_LIMIT = 8; // 增加并发数
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: CONCURRENCY_LIMIT,
});

const DOWNLOAD_TIMEOUT = 30000; // 30 seconds timeout for downloads

function promptUser(message, validOptions, defaultValue) {
  return new Promise((resolve) => {
    const promptMessage = defaultValue !== undefined
      ? `${message} (default: ${defaultValue}): `
      : message;

    rl.question(promptMessage, (input) => {
      // 如果用户直接回车且有默认值，使用默认值
      if (input.trim() === '' && defaultValue !== undefined) {
        input = defaultValue;
      }

      if (validOptions && !validOptions.includes(input)) {
        console.log("Invalid input. Please enter a valid option.");
        rl.question(promptMessage, (input) => {
          if (validOptions.includes(input)) {
            resolve(input);
          }
        });
      } else {
        resolve(input);
      }
    });
  });
}

async function selectCategoryTag() {
  console.log(`
****************************************************************
                        Category Codes
all     - Every wallpaper.
general - For 'general' wallpapers only.
anime   - For 'Anime' Wallpapers only.
people  - For 'people' wallpapers only.
ga      - For 'General' and 'Anime' wallpapers only.
gp      - For 'General' and 'People' wallpapers only.
****************************************************************
`);
  const input = await promptUser("Enter Category", Object.keys(categories), "all");

  const category = categories[input] || "111";

  queryObject.set("categories", category);
}

async function selectPurityTag() {
  console.log(`
****************************************************************
                        Purity Codes
sfw     - For 'Safe For Work'
sketchy - For 'Sketchy'
nsfw    - For 'Not Safe For Work'
ws      - For 'SFW' and 'Sketchy'
wn      - For 'SFW' and 'NSFW'
sn      - For 'Sketchy' and 'NSFW'
all     - For 'SFW', 'Sketchy' and 'NSFW'
****************************************************************
`);

  const input = await promptUser("Enter Purity", Object.keys(purities), "sfw");

  const purity = purities[input] || "100";

  queryObject.set("purity", purity);
}

async function selectTopRange() {
  const input = await promptUser(
    "Enter the range for toplist",
    valid_ranges,
    "1M"
  );

  queryObject.set("topRange", input);
}

async function buildCategoryQueryParams() {
  await selectCategoryTag();
  await selectPurityTag();
}

async function buildLatestQueryParams() {
  await selectTopRange();
  queryObject.set("sorting", "toplist");
}

async function buildSearchQueryParams() {
  const query = await promptUser("Enter search query: ");
  queryObject.set("q", query);
}

async function buildToplistQueryParams() {
  await selectCategoryTag();
  await selectPurityTag();
  await selectTopRange();
  queryObject.set("sorting", "toplist");
  queryObject.set("order", "desc");
}

async function saveImageToFile(
  image_url,
  file_path,
  current_image,
  total_images
) {
  const onError = (resolve) => (err) => {
    console.error(`Error downloading ${file_path}: ${err.message}`);
    resolve(false);
  };

  if (!fs.existsSync(file_path)) {
    const img_response = await new Promise((resolve, reject) => {
      const request = https
        .get(
          image_url,
          {
            headers: { Cookie: COOKIES, "X-API-Key": API_KEY },
            agent: httpsAgent,
            timeout: DOWNLOAD_TIMEOUT,
          },
          (res) => {
            if (res.statusCode === 200) {
              const writer = fs.createWriteStream(file_path, {
                flags: "w",
                encoding: "binary",
                highWaterMark: 64 * 1024,
              });

              let downloaded = 0;
              const total = parseInt(res.headers["content-length"], 10);

              const timeout = setTimeout(() => {
                res.destroy();
                writer.end();
                fs.unlink(file_path, () => { }); // Clean up incomplete file
                onError(resolve)(new Error("Download timeout"));
              }, DOWNLOAD_TIMEOUT);

              res.on("data", (chunk) => {
                downloaded += chunk.length;
                const progress = Math.min(
                  Math.round((downloaded / total) * 100),
                  100
                );
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                process.stdout.write(
                  `Downloading ${file_path
                    .split("/")
                    .pop()} - ${progress}% (${current_image}/${total_images})`
                );
              });

              res.pipe(writer);

              writer.on("finish", () => {
                clearTimeout(timeout);
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                process.stdout.write(
                  `Downloading ${file_path
                    .split("/")
                    .pop()} - 100% (${current_image}/${total_images})\n`
                );
                resolve(true);
              });

              writer.on("error", (err) => {
                clearTimeout(timeout);
                writer.end();
                fs.unlink(file_path, () => { }); // Clean up incomplete file
                onError(resolve)(err);
              });
            } else {
              onError(resolve)(
                new Error(`Failed to download image: ${res.statusCode}`)
              );
            }
          }
        )
        .on("error", onError(resolve));

      request.on("timeout", () => {
        request.destroy();
        onError(resolve)(new Error("Connection timeout"));
      });
    });

    if (!img_response) {
      console.log(
        `Failed to download ${file_path
          .split("/")
          .pop()} - ${current_image}/${total_images}`
      );
    }
  } else {
    console.log(
      `${file_path
        .split("/")
        .pop()} already exists - ${current_image}/${total_images}`
    );
  }
}

async function downloadPage(pageId, totalCount, folderName, offsetIndex) {
  const pagePrams = new URLSearchParams(queryObject);
  pagePrams.set("page", pageId);
  const url = `${BASE_API_URL}?${pagePrams.toString()}`;

  console.log(`Downloading url: ${url}`);

  const response = await new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { Cookie: COOKIES, "X-API-Key": API_KEY } },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve(JSON.parse(data));
          });
        }
      )
      .on("error", (err) => {
        reject(err);
      });
  });

  const pageData = response.data || [];

  const batchSize = CONCURRENCY_LIMIT;
  for (let i = 0; i < pageData.length; i += batchSize) {
    const batch = pageData.slice(i, i + batchSize);
    const promises = batch.map((data, index) => {
      const curImage = (pageId - 1) * 24 + (i + index + 1) - offsetIndex;
      const imagePath = data.path;
      const filename = imagePath.split("/").pop();
      const localFilePath = `${folderName}/${filename}`;
      return saveImageToFile(imagePath, localFilePath, curImage, totalCount);
    });
    await Promise.all(promises);
  }
}

async function selectChoice() {
  const choice = await promptUser(
    `Choose how you want to download the image:
    Enter "category" for downloading wallpapers from specified categories
    Enter "latest" for downloading latest wallpapers
    Enter "toplist" for downloading top list wallpapers
    Enter "search" for downloading wallpapers from search
    Enter choice`,
    ["category", "latest", "search", "toplist"],
    "toplist"
  );
  return choice;
}

async function getFolderName() {
  const folderName = await promptUser("Enter folder name", null, "Wallpapers");
  return path.join(process.cwd(), folderName);
}

async function main() {
  const FOLDER_NAME = await getFolderName();

  // Create directory if it doesn't exist
  if (!fs.existsSync(FOLDER_NAME)) {
    fs.mkdirSync(FOLDER_NAME);
  }

  const choice = await selectChoice();

  if (choice === "category") {
    await buildCategoryQueryParams();
  } else if (choice === "latest") {
    await buildLatestQueryParams();
  } else if (choice === "toplist") {
    await buildToplistQueryParams();
  } else if (choice === "search") {
    await buildSearchQueryParams();
  }

  const start_page = parseInt(
    await promptUser("Enter the start page", null, "0"),
    10
  );

  const pages_to_download = parseInt(
    await promptUser("How many pages do you want to download", null, "1"),
    10
  );

  const total_images_to_download = 24 * pages_to_download;
  console.log(`Number of Wallpapers to Download: ${total_images_to_download}`);
  console.log(`Starting from page: ${start_page}`);

  const startTime = Date.now();

  for (
    let page_index = start_page;
    page_index < start_page + pages_to_download;
    page_index++
  ) {
    await downloadPage(
      page_index,
      total_images_to_download,
      FOLDER_NAME,
      start_page * 24
    );
  }

  rl.close();

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  console.log(`Total download time: ${duration} seconds`);
}

main();
