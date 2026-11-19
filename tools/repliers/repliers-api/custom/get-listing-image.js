import { apiFetch, readFailure, errorMessage } from "../../../../lib/apiRequest.js";
import { apiBaseUrl } from "../../../../lib/apiBase.js";

// The endpoint answers with the photo already wrapped as MCP content,
// { content: [{ type: "image", data: <base64>, mimeType }] }, labelled application/json.
// Raw image bytes (image/*) are accepted too, should the API ever serve them directly.
async function readImage(response) {
  const type = response.headers.get("content-type") || "";
  if (type.startsWith("image/")) {
    const bytes = Buffer.from(await response.arrayBuffer());
    return { data: bytes.toString("base64"), mimeType: type.split(";")[0].trim() };
  }
  let body;
  try {
    body = JSON.parse(await response.text());
  } catch {
    return null;
  }
  const block = Array.isArray(body?.content)
    ? body.content.find((item) => item?.type === "image" && typeof item.data === "string" && item.data)
    : null;
  if (!block) return null;
  return { data: block.data, mimeType: typeof block.mimeType === "string" && block.mimeType ? block.mimeType : "image/jpeg" };
}

/**
 * Function to download a listing's photo from the Repliers API.
 *
 * Fetches the photo server-side (rather than returning a CDN URL), which is
 * useful when a URL to the image would be blocked by network restrictions on
 * the caller's side (or vice versa).
 *
 * @param {Object} args - Arguments for downloading a listing image.
 * @param {string} args.mlsNumber - The MLS number of the listing.
 * @param {number} [args.imageNumber] - 1-based index of the image to download. Defaults to 1 (cover image).
 * @returns {Promise<Object>} - The result containing base64 image data, or an error.
 */
const executeFunction = async (args) => {
  const mlsNumber = args.mlsNumber;
  const imageNumber = args.imageNumber || 1;
  let finalUrl;

  try {
    const url = new URL(
      `${apiBaseUrl()}/listings/${encodeURIComponent(mlsNumber)}/images/download/${encodeURIComponent(imageNumber)}`
    );
    finalUrl = url.toString();
    const response = await apiFetch(finalUrl, args, {
      method: "GET",
      accept: "application/json, image/*",
    });

    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return {
        url: finalUrl,
        error: errorMessage(body) || `Failed to download image ${imageNumber} for listing ${mlsNumber}: HTTP ${status}`,
        status,
        body,
      };
    }

    const image = await readImage(response);
    if (!image) {
      // A 200 without a usable image means there is no such photo (index past photoCount, listing
      // without photos): a deterministic not-found, so the agent is not told to retry and no
      // upstream incident is captured.
      return {
        url: finalUrl,
        error: `The Repliers API returned no image data for image ${imageNumber} of listing ${mlsNumber}.`,
        status: 404,
        body: null,
      };
    }

    return { url: finalUrl, image };
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
};

/**
 * Tool configuration for downloading a listing image using the Repliers API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "Get_Listing_Image",
      description: `Downloads a listing's photo directly from the Repliers API and returns it as base64-encoded image data (an MCP image content block), rather than a URL. This is useful for a gen AI assistant when a plain image URL might be blocked by the assistant's network (or vice versa) — the image is fetched server-side and handed back as viewable image data instead.

imageNumber 1 is the cover/primary photo; request 2, 3, 4, etc. to page through subsequent photos. Use get-listing to find the listing's photoCount if you need to know how many images are available in total.`,
      parameters: {
        type: "object",
        properties: {
          mlsNumber: {
            type: "string",
            description: "The MLS number of the listing whose image you want to download.",
          },
          imageNumber: {
            type: "integer",
            description: "The 1-based index of the image to download. 1 is the cover image. Defaults to 1.",
          },
        },
        required: ["mlsNumber"],
      },
    },
  },
};

export { apiTool };
