/**
 * Function to download a listing's photo from the Repliers API.
 *
 * Fetches the raw JPEG bytes directly (rather than returning a CDN URL), which
 * is useful when a URL to the image would be blocked by network restrictions
 * on the caller's side (or vice versa). Also reports the listing's photoCount
 * so callers know how many images are available and can page through them via
 * imageNumber (1 = cover image, 2, 3, 4, ... up to photoCount).
 *
 * @param {Object} args - Arguments for downloading a listing image.
 * @param {string} args.mlsNumber - The MLS number of the listing.
 * @param {number} [args.imageNumber] - 1-based index of the image to download. Defaults to 1 (cover image).
 * @returns {Promise<Object>} - The result containing base64 image data, or an error.
 */
const executeFunction = async (args) => {
  const baseUrl = "https://dev.repliers.io";
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;
  const mlsNumber = args.mlsNumber;
  const imageNumber = args.imageNumber || 1;
  let finalUrl;

  try {
    const headers = { "REPLIERS-API-KEY": apiKey };

    // Look up the listing's photoCount so callers know how many images exist.
    let photoCount = null;
    const listingUrl = `${baseUrl}/listings/${encodeURIComponent(mlsNumber)}`;
    const listingResponse = await fetch(listingUrl, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
    });
    if (listingResponse.ok) {
      const listingData = await listingResponse.json();
      photoCount = listingData.photoCount ?? null;
    }

    // Download the requested image.
    const url = new URL(
      `${baseUrl}/listings/${encodeURIComponent(mlsNumber)}/images/download/${encodeURIComponent(imageNumber)}`
    );
    finalUrl = url.toString();

    const response = await fetch(finalUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download image ${imageNumber} for listing ${mlsNumber}: ${response.status} ${response.statusText}`
      );
    }

    const mimeType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    return {
      url: finalUrl,
      image: {
        data: base64Data,
        mimeType,
        metadata: {
          mlsNumber,
          imageNumber,
          photoCount,
          hasMoreImages: photoCount !== null ? imageNumber < photoCount : undefined,
        },
      },
    };
  } catch (error) {
    return {
      error: "An error occurred while downloading the listing image.",
      details: error.message,
      url: finalUrl,
    };
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
      description: `Downloads a listing's photo directly from the Repliers API and returns the raw image bytes, rather than a URL. This is useful for a gen AI assistant when a plain image URL might be blocked by the assistant's network (or vice versa) — the image is fetched server-side and handed back as usable image data instead.

imageNumber 1 is the cover/primary photo; request 2, 3, 4, etc. to page through subsequent photos. The response also reports the listing's total photoCount so you know how many images are available in total, and whether more remain.`,
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
