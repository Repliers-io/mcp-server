// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: PATCH /estimates/{estimateId} (operationId: create-an-estimate-copy)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  let urlPath = '/estimates/{estimateId}';
  urlPath = urlPath.replace('{estimateId}', encodeURIComponent(String(args.estimateId)));
  const url = new URL(`${baseUrl}${urlPath}`);

  const body = {};
  if (args.overallQuality !== undefined) body.overallQuality = args.overallQuality;
  if (args.address !== undefined) body.address = args.address;
  if (args.condominium !== undefined) body.condominium = args.condominium;
  if (args.details !== undefined) body.details = args.details;
  if (args.lot !== undefined) body.lot = args.lot;
  if (args.sendEmailNow !== undefined) body.sendEmailNow = args.sendEmailNow;
  if (args.sendEmailMonthly !== undefined) body.sendEmailMonthly = args.sendEmailMonthly;
  if (args.taxes !== undefined) body.taxes = args.taxes;
  if (args.clientId !== undefined) body.clientId = args.clientId;

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
      'Content-Type': 'application/json',
        'REPLIERS-API-KEY': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(JSON.stringify(err));
    }

    const data = await response.json();
    return { url: finalUrl, data };
  } catch (error) {
    return { url: finalUrl, error: error.message };
  }
};

export const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: "update-estimate",
      description: "Updates an existing property value estimate with revised property attributes. Use this if property details have changed and you need a recalculated estimate.",
      parameters: {
        type: 'object',
        properties: {
          "estimateId": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "overallQuality": {
            "type": "string",
            "description": "An indication of the overall renovation quality of the property. You may use a numeric value between 1.0 and 6.0 or one of these strings: poor, below average, average, above average, excellent. If not specified, defaults to average."
          },
          "address": {
            "properties": {
              "city": {
                "type": "string"
              },
              "streetName": {
                "type": "string"
              },
              "streetNumber": {
                "type": "string"
              },
              "streetSuffix": {
                "type": "string"
              },
              "unitNumber": {
                "type": "string"
              },
              "zip": {
                "type": "string"
              }
            },
            "required": [
              "streetName",
              "streetNumber"
            ],
            "type": "object",
            "description": ""
          },
          "condominium": {
            "properties": {
              "fees": {
                "properties": {
                  "maintenance": {
                    "type": "integer",
                    "format": "int32"
                  }
                },
                "required": [],
                "type": "object"
              }
            },
            "required": [],
            "type": "object",
            "description": ""
          },
          "details": {
            "properties": {
              "basement1": {
                "type": "string"
              },
              "basement2": {
                "type": "string"
              },
              "numBathrooms": {
                "type": "integer",
                "format": "int32"
              },
              "numBedrooms": {
                "type": "integer",
                "format": "int32"
              },
              "numGarageSpaces": {
                "type": "integer",
                "format": "int32"
              },
              "numParkingSpaces": {
                "type": "integer",
                "format": "int32"
              },
              "propertyType": {
                "type": "string",
                "enum": [
                  "Att/Row/Twnhouse",
                  "Co-Op Apt",
                  "Co-Ownership Apt",
                  "Comm Element Condo",
                  "Condo Apt",
                  "Condo Townhouse",
                  "Cottage",
                  "Det Condo",
                  "Detached",
                  "Duplex",
                  "Farm",
                  "Fourplex",
                  "Leasehold Condo",
                  "Link",
                  "Locker",
                  "Lower Level",
                  "Mobile/Trailer",
                  "Multiplex",
                  "Other",
                  "Parking Space",
                  "Room",
                  "Rural Resid",
                  "Semi-Det Condo",
                  "Semi-Detached",
                  "Shared Room",
                  "Store W/Apt/Offc",
                  "Store W/Apt/Office",
                  "Time Share",
                  "Triplex",
                  "Upper Level",
                  "Vacant Land",
                  "Vacant Land Condo"
                ]
              },
              "sqft": {
                "type": "integer",
                "format": "int32"
              },
              "style": {
                "type": "string"
              },
              "yearBuilt": {
                "type": "integer",
                "format": "int32"
              }
            },
            "required": [],
            "type": "object",
            "description": ""
          },
          "lot": {
            "properties": {
              "acres": {
                "type": "string"
              },
              "depth": {
                "type": "integer",
                "format": "int32"
              },
              "width": {
                "type": "integer",
                "format": "int32"
              }
            },
            "required": [],
            "type": "object",
            "description": ""
          },
          "sendEmailNow": {
            "type": "boolean",
            "description": "If set to true and there's a clientId specified, the client will receive a message immediately with a link that will allow them to access their estimate. Note - your account must have the Repliers messaging addon to use this feature.",
            "default": false
          },
          "sendEmailMonthly": {
            "type": "boolean",
            "description": "If set to true and there's a clientId specified, the client will receive a message on a monthly basis with a link to a current estimate.  Note - your account must have the Repliers messaging addon to use this feature.",
            "default": false
          },
          "taxes": {
            "properties": {
              "annualAmount": {
                "type": "integer",
                "format": "int32"
              }
            },
            "required": [],
            "type": "object",
            "description": ""
          },
          "clientId": {
            "type": "integer",
            "description": "Set this to the clientId that the estimate is for if you wish to store the estimate. If sendEmailNow or sendEmailMonthly is used, messages containing estimates will be sent to this clientId.",
            "format": "int32"
          }
        },
        required: ["estimateId"],
      },
    },
  },
};
