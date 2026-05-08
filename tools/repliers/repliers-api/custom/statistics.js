/**
 * Comprehensive Repliers API Listings Search Tool
 * Fixed version that properly handles map parameter and body/query separation
 * Modified to always set listings=false
 */

const executeFunction = async (args) => {
  const baseUrl = "https://api.repliers.io";
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;
  // const defaultResultsPerPage = parseInt(process.env.RESULTS_PER_PAGE) || 20;
  let finalUrl;

  try {
    // Construct base URL
    const url = new URL(`${baseUrl}/listings`);

    // Separate body parameters from query parameters
    const bodyParams = {};

    // Handle special parameter serialization
    if (args.params) {
      const { imageSearchItems, map, ...queryParams } = args.params;

      // ImageSearchItems always goes in body when present
      if (imageSearchItems && Array.isArray(imageSearchItems)) {
        bodyParams.imageSearchItems = imageSearchItems;
      }

      // Map parameter goes in body when present (triggers POST)
      if (map) {
        bodyParams.map = map;
      }

      // Process all other parameters as query parameters
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((item) => {
              url.searchParams.append(key, String(item));
            });
          } else if (typeof value === "boolean") {
            url.searchParams.set(key, String(value));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      });
    }

    // Add pagination parameters (these are query params, not in the params object)
    if (args.pageNum !== undefined) {
      url.searchParams.set("pageNum", String(args.pageNum));
    }
    // Use explicit resultsPerPage if provided, otherwise use environment variable
    // const resultsPerPage = args.resultsPerPage || defaultResultsPerPage;
    // url.searchParams.set("resultsPerPage", String(resultsPerPage));
    
    // Always set listings to false to exclude listing results
    url.searchParams.set("listings", "false");

    // Capture final URL
    finalUrl = url.toString();

    // Set headers
    const headers = {
      Accept: "application/json",
      "REPLIERS-API-KEY": apiKey,
    };

    // Determine if we need to send a body
    const hasBodyParams = Object.keys(bodyParams).length > 0;

    if (hasBodyParams) {
      headers["Content-Type"] = "application/json";
    }

    // Execute request
    const response = await fetch(finalUrl, {
      method: hasBodyParams ? "POST" : "GET",
      headers,
      ...(hasBodyParams && { body: JSON.stringify(bodyParams) }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        url: finalUrl,
        method: hasBodyParams ? "POST" : "GET",
        status: response.status,
        error: errorData.error || "API request failed",
        details: errorData.details || errorData,
      };
    }

    const data = await response.json();
    return {
      url: finalUrl,
      method: hasBodyParams ? "POST" : "GET",
      status: response.status,
      data: {
        ...data,
        _metadata: {
          totalResults: data.count || 0,
          totalPages: data.numPages || 0,
          currentPage: data.pagination?.currentPage || args.pageNum || 1,
          // resultsPerPage:
          //   data.pagination?.resultsPerPage ||
          //   resultsPerPage ||
          //   defaultResultsPerPage,
        },
      },
    };
  } catch (error) {
    console.error("Repliers API error:", error);
    return {
      url: finalUrl,
      error: "Network or processing error",
      details: error.message,
    };
  }
};

const repliersListingsSearchTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "Market_Statistics",
      description: ` 
        This is used to generate market statistics and reports such as producing metrics like average days on market, or average sold price.
        It's granular and allows the user to provide specific statisics by combining different property attributes. For example "average sold price for a 1 bedroom condo in toronto since the beginning of the year grouped by month"
        You can also aggregate statistics by fields, for example "average sold price for a 1 bedroom condo in toronto since the beginning of the year grouped by neighborhood"
        Before using this function, you should first lookup possible values to ensure that you're using the correct value. For example, if someone asks  to find listings
        in "St. Louis" it may returned zero results because the correct name of the city is "St Louis" (no dot). Looking up possible values for address.city would prevent
        having to send multiple trial and error requests.
        `,
      parameters: {
        type: "object",
        properties: {
          params: {
            type: "object",
            properties: {
              // Location parameters
              city: {
                type: "array",
                items: { type: "string" },
                description: "Filter statistics by one or more cities.",
              },
              state: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filter by the address state, for example 'NY'",
              },
              area: {
                type: "string",
                description:
                  "Filter by the geographical area (also referred to as region or county)",
              },
              areaOrCity: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filters where either the address.area or address.city field matches any of the provided values",
              },
              neighborhood: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filter by the geographical neighborhood, also referred to as community.",
              },
              district: {
                type: "string",
                description:
                  "Filter by the geographical district",
              },
              zip: {
                type: "string",
                description: "Filters by postal or zip code",
              },

              // Geographic parameters
              lat: {
                type: "string",
                description:
                  "Latitude value. Must be used with radius parameter",
              },
              long: {
                type: "string",
                description:
                  "Longitude value. Must be used with radius parameter",
              },
              radius: {
                type: "number",
                description:
                  "Radius in KM. Must be used with lat and long parameters",
              },
              

              // Property details
              propertyType: {
                type: "array",
                items: { type: "string" },
                description: "Filters by one or more property types",
              },
              propertyTypeOrStyle: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filters where either propertyType or style matches",
              },
              style: {
                type: "array",
                items: { type: "string" },
                description: "Filter by the property style",
              },

             
              minBedroomsTotal: {
                type: "number",
                description: "Minimum total bedrooms (bedrooms + bedroomsPlus)",
              },
              maxBedroomsTotal: {
                type: "number",
                description: "Maximum total bedrooms (bedrooms + bedroomsPlus)",
              },
              minBaths: {
                type: "number",
                description: "Minimum number of bathrooms",
              },
              maxBaths: {
                type: "number",
                description: "Maximum number of bathrooms",
              },
             

              // Size parameters
              minSqft: {
                type: "number",
                description:
                  "Minimum square footage (excludes records without sqft)",
              },
              maxSqft: {
                type: "number",
                description:
                  "Maximum square footage (excludes records without sqft)",
              },
             

              // Year built
              minYearBuilt: {
                type: "string",
                description:
                  "Minimum year built (excludes records without year)",
              },
              maxYearBuilt: {
                type: "number",
                description:
                  "Maximum year built (excludes records without year)",
              },
             

              // Parking parameters
              minParkingSpaces: {
                type: "number",
                description: "Minimum parking spaces",
              },
              minGarageSpaces: {
                type: "number",
                description: "Minimum garage spaces",
              },

              // Status and type
              status: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["A", "U"],
                },
                description:
                  "A = active records, U = unavailable records (default: A)",
              },
              lastStatus: {
                type: "array",
                items: {
                  type: "string",
                  enum: [
                    "Sus",
                    "Exp",
                    "Sld",
                    "Ter",
                    "Dft",
                    "Lsd",
                    "Sc",
                    "Sce",
                    "Lc",
                    "Pc",
                    "Ext",
                    "New",
                  ],
                },
                description: `Filter by last status of the listing
                Here's a breakdown:
                Sus = Suspended
                Exp = Expired
                Sld = Sold
                Ter = Terminated
                Dft = Deal Fell Through
                Lsd = Leased
                Sc = Sold Conditionally
                Sce = Sold Conditionally with Escape Clause (rare)
                Lc = Leased Conditionally
                Pc = Price Change
                Ext = Extension
                New = New
                Cs = Coming Soon
                `,
              },
              type: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["sale", "lease"],
                },
                description: "Filter records for sale or lease",
              },

           

            

              // Agent and brokerage
              agent: {
                type: "array",
                items: { type: "string" },
                description: "Filter by agent name or agent ID",
              },
              brokerage: {
                type: "string",
                description: "Filter records by brokerage name",
              },
              officeId: {
                type: "string",
                description:
                  "Filter records by the office ID of the listing brokerage",
              },
             

              // Date filters
              listDate: {
                type: "string",
                format: "date",
                description: "Filter by specific list date (YYYY-MM-DD)",
              },
              minListDate: {
                type: "string",
                format: "date",
                description:
                  "Records listed on or after this date (YYYY-MM-DD)",
              },
              maxListDate: {
                type: "string",
                format: "date",
                description:
                  "Records listed on or before this date (YYYY-MM-DD)",
              },
              minSoldDate: {
                type: "string",
                format: "date",
                description:
                  "Records sold/leased on or after this date (YYYY-MM-DD)",
              },
              maxSoldDate: {
                type: "string",
                format: "date",
                description:
                  "Records sold/leased on or before this date (YYYY-MM-DD)",
              },
            
              minUnavailableDate: {
                type: "string",
                format: "date",
                description:
                  "Records unavailable on or after this date (YYYY-MM-DD)",
              },
              maxUnavailableDate: {
                type: "string",
                format: "date",
                description:
                  "Records unavailable on or before this date (YYYY-MM-DD)",
              },
              
            

             

              // Aggregation and clustering
              aggregates: {
                type: "string",
                description: `Aggregates are essentially groupings. For example, if asked to aggregate the propertyTypes
                              in the response, you'd add 'details.propertyType' to the aggregates parameter. You can specify multiple
                              fields to aggregate in a single request by comma-separating them, for example 'details.propertyType,details.style,details.numBedrooms'
                              This is useful for enumerating fields as well. This also could be referred to as 'getting a break down' for a field.
                              When you specify a field name in aggregates, it has to match the exact field name in the listing response model. Here's what the listing model looks like:

{
    "mlsNumber": "S12498656",
    "resource": "Property:2381",
    "status": "A",
    "class": "ResidentialProperty",
    "type": "Sale",
    "listPrice": "519000.00",
    "listDate": "2025-11-01T00:00:00.000Z",
    "lastStatus": "New",
    "soldPrice": null,
    "soldDate": null,
    "originalPrice": "519000",
    "assignment": null,
    "address": {
        "area": "Simcoe",
        "city": "Midland",
        "country": "Canada",
        "district": null,
        "majorIntersection": "Yonge/Bay",
        "neighborhood": "Midland",
        "streetDirection": null,
        "streetName": "Bay",
        "streetNumber": "644",
        "streetSuffix": "St",
        "unitNumber": null,
        "zip": "L4R 1L9",
        "state": "Ontario",
        "communityCode": null,
        "streetDirectionPrefix": null,
        "addressKey": "644baystreetmidland"
    },
    "map": {
        "latitude": "44.74935199999999",
        "longitude": "-79.8929394",
        "point": "POINT (-79.8929394 44.74935199999999)",
        "placeId": "ChIJJx1PiwjbKk0RrriUBgpwvw8"
    },
    "permissions": {
        "displayAddressOnInternet": "Y",
        "displayPublic": "Y",
        "displayInternetEntireListing": "Y"
    },
    "images": [
        "IMG-S12498656_1.jpg",
        "IMG-S12498656_2.jpg",
        "IMG-S12498656_3.jpg",
        "IMG-S12498656_4.jpg",
        "IMG-S12498656_5.jpg",
        "IMG-S12498656_6.jpg",
        "IMG-S12498656_7.jpg",
        "IMG-S12498656_8.jpg",
        "IMG-S12498656_9.jpg",
        "IMG-S12498656_10.jpg",
        "IMG-S12498656_11.jpg",
        "IMG-S12498656_12.jpg",
        "IMG-S12498656_13.jpg",
        "IMG-S12498656_14.jpg",
        "IMG-S12498656_15.jpg"
    ],
    "photoCount": 15,
    "details": {
        "airConditioning": "None",
        "basement1": "Exposed Rock",
        "basement2": "Unfinished",
        "centralVac": "N",
        "den": "N",
        "description": "Attention Investors or First Time Home Buyers.  Amazing Opportunity.  One Structure - Two Semi-Detached Houses. Live in One Complete Semi-Detached House and Rent Out the Other One.  Or Rent Out Both.  Legal Duplex!  Municipal Address 642/644 Bay Street is a 50 x 150 Foot Lot with A Full Semi-Detached Structure Being Sold. 3 Kitchens, 3 Bathrooms, 5 Bedrooms. Parking on Both Sides of the Houses.  Garage Converted to Storage with Man Door with Bonus Space Above.  The Price is Well Worth the Drive to Midland!",
        "elevator": null,
        "exteriorConstruction1": "Alum Siding",
        "exteriorConstruction2": null,
        "extras": "See Schedule C",
        "furnished": null,
        "garage": "None",
        "heating": "Forced Air",
        "numBathrooms": "3",
        "numBathroomsPlus": null,
        "numBedrooms": "5",
        "numBedroomsPlus": null,
        "numFireplaces": "N",
        "numGarageSpaces": null,
        "numParkingSpaces": "3",
        "numRooms": "12",
        "numRoomsPlus": null,
        "patio": null,
        "propertyType": "Duplex",
        "sqft": "2000-2500",
        "style": "2-Storey",
        "swimmingPool": "None",
        "virtualTourUrl": null,
        "yearBuilt": "100+",
        "landAccessType": null,
        "landSewer": null,
        "viewType": null,
        "zoningDescription": null,
        "analyticsClick": null,
        "moreInformationLink": null,
        "alternateURLVideoLink": null,
        "flooringType": null,
        "foundationType": "Stone",
        "landscapeFeatures": null,
        "fireProtection": null,
        "roofMaterial": "Asphalt Shingle",
        "farmType": null,
        "zoningType": null,
        "businessType": null,
        "businessSubType": null,
        "landDisposition": null,
        "storageType": null,
        "constructionStyleSplitLevel": null,
        "constructionStatus": null,
        "loadingType": null,
        "ceilingType": null,
        "liveStreamEventURL": null,
        "energuideRating": null,
        "amperage": null,
        "sewer": "Sewers",
        "familyRoom": "N",
        "zoning": "R3",
        "driveway": "Private",
        "leaseTerms": null,
        "centralAirConditioning": null,
        "certificationLevel": null,
        "energyCertification": "N",
        "parkCostMonthly": null,
        "commonElementsIncluded": null,
        "greenPropertyInformationStatement": "N",
        "handicappedEquipped": null,
        "laundryLevel": null,
        "numKitchens": "3",
        "numKitchensPlus": null,
        "sqftRange": null,
        "numDrivewaySpaces": null,
        "HOAFee": null,
        "HOAFee2": null,
        "HOAFee3": null,
        "waterSource": "Municipal",
        "livingAreaMeasurement": null,
        "waterfront": null,
        "bathrooms": {
            "1": {
                "level": "2nd",
                "count": "1",
                "pieces": "4"
            },
            "2": {
                "level": "2nd",
                "count": "1",
                "pieces": "4"
            },
            "3": {
                "level": "Ground",
                "count": "1",
                "pieces": "3"
            },
            "4": {
                "level": null,
                "count": null,
                "pieces": null
            },
            "5": {
                "level": null,
                "count": null,
                "pieces": null
            }
        },
        "numBathroomsHalf": null
    },
    "daysOnMarket": null,
    "occupancy": "Minimum 90 Days",
    "updatedOn": "2025-11-01T08:39:15.000Z",
    "condominium": {
        "ammenities": [],
        "buildingInsurance": null,
        "condoCorp": null,
        "condoCorpNum": null,
        "exposure": null,
        "lockerNumber": "",
        "locker": null,
        "parkingType": null,
        "pets": null,
        "propertyMgr": null,
        "stories": null,
        "fees": {
            "cableInlc": null,
            "heatIncl": null,
            "hydroIncl": null,
            "maintenance": null,
            "parkingIncl": null,
            "taxesIncl": null,
            "waterIncl": null
        },
        "lockerUnitNumber": null,
        "ensuiteLaundry": "N",
        "sharesPercentage": null,
        "lockerLevel": null,
        "unitNumber": null
    },
    "coopCompensation": "2.5% + HST",
    "lot": {
        "acres": null,
        "depth": "149.35",
        "irregular": null,
        "legalDescription": "PT LT 10 W/S FOURTH ST, 11 W/S FOURTH ST, 12 W/S FOURTH ST PL 306 MIDLAND AS IN RO1428838: MIDLAND",
        "measurement": "Feet",
        "width": "50.27",
        "size": null,
        "source": "MPAC",
        "dimensionsSource": null,
        "dimensions": null,
        "squareFeet": null,
        "features": null,
        "taxLot": null
    },
    "nearby": {
        "ammenities": []
    },
    "office": {
        "brokerageName": "ROYAL LEPAGE RCR REALTY"
    },
    "openHouse": {
        "1": {
            "date": null,
            "endTime": null,
            "startTime": null,
            "type": null,
            "status": null,
            "TZ": "ET"
        },
        "2": {
            "date": null,
            "endTime": null,
            "startTime": null,
            "type": null,
            "status": null,
            "TZ": "ET"
        },
        "3": {
            "date": null,
            "endTime": null,
            "startTime": null,
            "type": null,
            "status": null,
            "TZ": "ET"
        }
    },
    "rooms": {
        "1": {
            "description": "Living",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "2.83",
            "width": "2.67",
            "level": "Ground"
        },
        "2": {
            "description": "Dining",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "3.37",
            "width": "4.58",
            "level": "Ground"
        },
        "3": {
            "description": "Kitchen",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "3.11",
            "width": "3.69",
            "level": "Ground"
        },
        "4": {
            "description": "Br",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "3.15",
            "width": "2.71",
            "level": "2nd"
        },
        "5": {
            "description": "Br",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "3.15",
            "width": "2.71",
            "level": "2nd"
        },
        "6": {
            "description": "Br",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "2.72",
            "width": "2.75",
            "level": "2nd"
        },
        "7": {
            "description": "Kitchen",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "3.44",
            "width": "3.32",
            "level": "Ground"
        },
        "8": {
            "description": "Living",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "3.31",
            "width": "3.96",
            "level": "Ground"
        },
        "9": {
            "description": "Br",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "2.89",
            "width": "2.74",
            "level": "Ground"
        },
        "10": {
            "description": "Kitchen",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "3.51",
            "width": "2.9",
            "level": "2nd"
        },
        "11": {
            "description": "Living",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "3.07",
            "width": "2.76",
            "level": "2nd"
        },
        "12": {
            "description": "Br",
            "features": null,
            "features2": null,
            "features3": null,
            "length": "3.17",
            "width": "2.96",
            "level": "2nd"
        }
    },
    "taxes": {
        "annualAmount": "4633.17",
        "assessmentYear": "2025"
    },
    "timestamps": {
        "idxUpdated": "2025-11-01T08:39:15.000Z",
        "listingUpdated": "2025-11-01T08:39:15.000Z",
        "photosUpdated": "2025-11-01T12:39:15.000Z",
        "conditionalExpiryDate": null,
        "terminatedDate": null,
        "suspendedDate": null,
        "listingEntryDate": "2025-11-01T12:39:15.000Z",
        "closedDate": null,
        "unavailableDate": null,
        "expiryDate": "2026-03-31T00:00:00.000Z",
        "extensionEntryDate": null,
        "possessionDate": null,
        "repliersUpdatedOn": "2025-11-01T14:44:22.424Z",
        "imageInsightsUpdatedOn": "2025-11-01T12:39:15.000Z"
    },
    "agents": [],
    "history": [],
    "comparables": [],
    "estimate": {
        "high": 576328.7827619337,
        "low": 462576.7172380662,
        "value": 519452.75,
        "date": "2025-11-01T12:59:19.605Z",
        "confidence": 0.10949221611,
        "history": {
            "mth": {
                "2025-11": {
                    "value": 519452.75
                },
                "2025-10": {
                    "value": 515411.25
                },
                "2025-09": {
                    "value": 514034.3125
                },
                "2025-08": {
                    "value": 512787.15625
                },
                "2025-07": {
                    "value": 511980.84375
                },
                "2025-06": {
                    "value": 511359.25
                },
                "2025-05": {
                    "value": 511106.90625
                },
                "2025-04": {
                    "value": 510217.4375
                },
                "2025-03": {
                    "value": 510440.90625
                },
                "2025-02": {
                    "value": 510310.3125
                },
                "2025-01": {
                    "value": 510700.8125
                },
                "2024-12": {
                    "value": 510184.1875
                },
                "2024-11": {
                    "value": 510696.5
                },
                "2024-10": {
                    "value": 510020.75
                },
                "2024-09": {
                    "value": 513047.4375
                },
                "2024-08": {
                    "value": 513766.5625
                },
                "2024-07": {
                    "value": 515648.34375
                },
                "2024-06": {
                    "value": 515257.75
                },
                "2024-05": {
                    "value": 506095.8125
                },
                "2024-04": {
                    "value": 502414.1875
                },
                "2024-03": {
                    "value": 500663.34375
                },
                "2024-02": {
                    "value": 501153.65625
                },
                "2024-01": {
                    "value": 500592.40625
                },
                "2023-12": {
                    "value": 499927.90625
                }
            }
        }
    },
    "imageInsights": {
        "summary": {
            "quality": {
                "qualitative": {
                    "features": {
                        "livingRoom": "average",
                        "frontOfStructure": "average",
                        "kitchen": "below average",
                        "bedroom": "below average",
                        "bathroom": "below average"
                    },
                    "overall": "below average"
                },
                "quantitative": {
                    "features": {
                        "livingRoom": 3.0389163494,
                        "frontOfStructure": 3.0352733135,
                        "kitchen": 2.4863619804,
                        "bedroom": 2.7308938503,
                        "bathroom": 2.2947211266
                    },
                    "overall": 2.7308938503
                }
            }
        },
        "images": [
            {
                "image": "IMG-S12498656_1.jpg",
                "classification": {
                    "imageOf": "Front of Structure",
                    "prediction": 0.9990698695
                },
                "quality": {
                    "qualitative": "average",
                    "quantitative": 3.0352733135
                }
            },
            {
                "image": "IMG-S12498656_2.jpg",
                "classification": {
                    "imageOf": "Front of Structure",
                    "prediction": 0.9883134365
                },
                "quality": {
                    "qualitative": "below average",
                    "quantitative": 2.6771602631
                }
            },
            {
                "image": "IMG-S12498656_5.jpg",
                "classification": {
                    "imageOf": "Kitchen",
                    "prediction": 0.9983212352
                },
                "quality": {
                    "qualitative": "below average",
                    "quantitative": 2.4863619804
                }
            },
            {
                "image": "IMG-S12498656_6.jpg",
                "classification": {
                    "imageOf": "Kitchen",
                    "prediction": 0.9387030602
                },
                "quality": {
                    "qualitative": "poor",
                    "quantitative": 1.3577387333
                }
            },
            {
                "image": "IMG-S12498656_9.jpg",
                "classification": {
                    "imageOf": "Kitchen",
                    "prediction": 0.9925559163
                },
                "quality": {
                    "qualitative": "poor",
                    "quantitative": 1.4394314289
                }
            },
            {
                "image": "IMG-S12498656_10.jpg",
                "classification": {
                    "imageOf": "Living Room",
                    "prediction": 0.956001699
                },
                "quality": {
                    "qualitative": "below average",
                    "quantitative": 2.6554141045
                }
            },
            {
                "image": "IMG-S12498656_11.jpg",
                "classification": {
                    "imageOf": "Living Room",
                    "prediction": 0.9981703758
                },
                "quality": {
                    "qualitative": "average",
                    "quantitative": 3.0389163494
                }
            },
            {
                "image": "IMG-S12498656_13.jpg",
                "classification": {
                    "imageOf": "Bedroom",
                    "prediction": 0.9918550253
                },
                "quality": {
                    "qualitative": "below average",
                    "quantitative": 2.7308938503
                }
            },
            {
                "image": "IMG-S12498656_14.jpg",
                "classification": {
                    "imageOf": "Bathroom",
                    "prediction": 0.9990388155
                },
                "quality": {
                    "qualitative": "below average",
                    "quantitative": 2.2947211266
                }
            },
            {
                "image": "IMG-S12498656_15.jpg",
                "classification": {
                    "imageOf": "Bathroom",
                    "prediction": 0.9954368472
                },
                "quality": {
                    "qualitative": "poor",
                    "quantitative": 1.3911601305
                }
            }
        ]
    },
    "simpleDaysOnMarket": 1,
    "standardStatus": "Active",
    "boardId": 2
}

                              `,
              },
              aggregateStatistics: {
                type: "boolean",
                description: `If statistics are requested as well as aggregates in the same request, the
                            statistics will be aggregated (grouped) by the field(s) specified in the aggregates parameter.
                            `,
              },
              statistics: {
                type: "string",
                description: `
Our Real Estate API offers a powerful feature that allows you to request real-time market statistics. This capability is invaluable for creating data visualizations, providing users with deep market insights to make more informed decisions. The feature offers a high level of granularity, enabling you to request specific scopes of market data just as you would when filtering listings.

# How to Request Statistics

### Step 1: Provide the Scope of Data

Begin by defining the scope of the data you wish to analyze using the GET /listings endpoint. This scope is defined in the same way you would filter for listings. For example, if you want statistics for 4-bedroom homes in New York City that have sold in the past 2 years, your request URL will look like this:

\`\`\`
https://api.repliers.io/listings?city=New York&minBeds=4&maxBeds=4&status=U&lastStatus=Sld&minSoldDate=2022-07-01
\`\`\`

###### Important: Status Parameter for Statistics

When using our API, the \`status\` parameter defaults to 'A' (Active) if not specified. However, many statistics require data from unavailable listings to be accurate.

**Why this matters:** Statistics like average sold price can only be calculated using sold listings, which have a status of 'U' (Unavailable). Active listings don't contain sold price information since they haven't been sold yet.

**What to do:** When requesting statistics that depend on sold or completed listings, always include \`status=U\` in your API request. Additionally, consider filtering by \`lastStatus\` since unavailable listings can have different outcomes:

* **Sld** - Contains sold price data
* **Ter** - Removed by owner
* **Exp** - Listing period ended

**Example:**

* ❌ Without status (defaults to Active): Limited statistics available
* ✅ With \`status=U\`: Access to all unavailable listings
* ✅ With \`status=U\` + \`lastStatus=Sld\`: Most accurate for sold price statistics

### Step 2: Specify the Statistics

To retrieve specific statistics, use the statistics parameter. For example, if you're interested in the average sold price, add &statistics=avg-soldPrice to your request. The full request URL would be:

\`\`\`
https://api.repliers.io/listings?city=New York&minBeds=4&maxBeds=4&status=U&lastStatus=Sld&minSoldDate=2022-07-01&statistics=avg-soldPrice
\`\`\`

This request will return all relevant listings along with a statistics object containing the average sold price:

\`\`\`json
{
  "statistics": {
    "soldPrice": {
      "avg": 823702
    }
  }
}
\`\`\`

###### Requesting Only Statistics

If you do not need the listings and only require the statistics, add &listings=false to your request. This can significantly reduce response time. For instance:

\`\`\`
https://api.repliers.io/listings?city=New York&minBeds=4&maxBeds=4&status=U&lastStatus=Sld&minSoldDate=2022-07-01&statistics=avg-soldPrice&listings=false
\`\`\`

# Supported Statistics

Supported statistics enable comprehensive market analysis by providing both central tendencies (averages and medians) and measures of variability (standard deviations and min/max values) across key real estate metrics.

###### Tax Statistics
* **\`avg-tax\` -** The average annual property tax amount across all properties in the dataset
* **\`med-tax\` -** The median annual property tax amount, representing the middle value when all tax amounts are sorted

###### Price Performance
* **\`pct-aboveBelowList\` -** The percentage of properties that sold above or below their listing price, providing insight into market competitiveness

###### Price per Square Foot
* **\`avg-priceSqft\` -** The average price per square foot, calculated by dividing the price by the property's square footage

###### Property Counts
* **\`cnt-available\` -** The total count of properties currently available for sale or lease
* **\`cnt-new\` -** The total count of newly listed properties within the specified timeframe
* **\`cnt-closed\` -** The total count of properties that have completed transactions (sold or leased)

###### Days on Market Statistics
* **\`sd-daysOnMarket\`** - The standard deviation of days on market, showing variability in listing durations
* **\`med-daysOnMarket\` -** The median number of days properties remain on the market before selling
* **\`avg-daysOnMarket\` -** The average number of days properties stay on the market
* **\`sum-daysOnMarket\` -** The total cumulative days all properties have been on the market
* **\`min-daysOnMarket\` -** The shortest time any property spent on the market
* **\`max-daysOnMarket\` -** The longest time any property spent on the market

###### List Price Statistics
* **\`sd-listPrice\` -** The standard deviation of listing prices
* **\`med-listPrice\` -** The median listing price
* **\`avg-listPrice\` -** The average listing price
* **\`sum-listPrice\` -** The total sum of all listing prices
* **\`min-listPrice\` -** The lowest listing price
* **\`max-listPrice\` -** The highest listing price

###### Sold Price Statistics
* **\`sd-soldPrice\` -** The standard deviation of sold prices
* **\`med-soldPrice\` -** The median sold price
* **\`avg-soldPrice\` -** The average sold price
* **\`sum-soldPrice\` -** The total sum of all sold prices
* **\`min-soldPrice\` -** The lowest sold price
* **\`max-soldPrice\` -** The highest sold price

###### Maintenance Fee Statistics
* **\`avg-maintenanceFee\` -** The average monthly maintenance fee
* **\`med-maintenanceFee\` -** The median monthly maintenance fee
* **\`avg-maintenanceFeePerSqft\` -** The average maintenance fee per square foot
* **\`med-maintenanceFeePerSqft\` -** The median maintenance fee per square foot

# Grouping Statistics

You can group statistics by different time periods to analyze trends. For example, to see how the average sold price has changed month-to-month over the past 2 years, add grp-mth as a comma-separated value to the statistics parameter:

\`\`\`
https://api.repliers.io/listings?city=New York&minBeds=4&maxBeds=4&status=U&lastStatus=Sld&minSoldDate=2022-07-01&statistics=avg-soldPrice,grp-mth&listings=false
\`\`\`

The response will include monthly data points:

\`\`\`json
{
  "statistics": {
    "soldPrice": {
      "avg": 823702,
      "mth": {
        "2022-07": {
          "avg": 743897,
          "count": 13303
        },
        "2022-08": {
          "avg": 759084,
          "count": 25539
        },
        "2022-09": {
          "avg": 739097,
          "count": 22919
        }
      }
    }
  }
}
\`\`\`

### Supported Groupings

* grp-day - By day
* grp-mth - By month
* grp-yr - By year
* grp-{x}-days - Rolling statistics (x = number of days)

###### Multiple Groupings

\`\`\`
https://api.repliers.io/listings?city=New York&minBeds=4&maxBeds=4&status=U&lastStatus=Sld&minSoldDate=2022-07-01&statistics=avg-soldPrice,grp-mth,grp-yr&listings=false
\`\`\`

###### Rolling Statistics

\`\`\`
https://api.repliers.io/listings?city=New York&minBeds=4&maxBeds=4&status=U&lastStatus=Sld&minSoldDate=2022-07-01&statistics=avg-soldPrice,grp-30-days&listings=false
\`\`\`

# Requesting Multiple Statistics

\`\`\`
https://api.repliers.io/listings?city=New York&minBeds=4&maxBeds=4&status=U&lastStatus=Sld&minSoldDate=2022-07-01&statistics=avg-daysOnMarket,avg-soldPrice,grp-mth&listings=false
\`\`\`

# Aggregating Statistics

\`\`\`
https://api.repliers.io/listings?city=New York&minBeds=4&maxBeds=4&status=U&lastStatus=Sld&minSoldDate=2022-07-01&statistics=avg-soldPrice,grp-mth&listings=false&aggregateStatistics=true&aggregates=address.neighborhood
\`\`\`

\`\`\`json
{
  "statistics": {
    "soldPrice": {
      "avg": 986486,
      "mth": {
        "2022-07": {
          "avg": 949437,
          "count": 4600,
          "aggregates": {
            "address": {
              "neighborhood": {
                "Waterfront Communities C1": {
                  "count": 74,
                  "avg": 805367
                },
                "Waterfront Communities C2": {
                  "count": 60,
                  "avg": 709361
                }
              }
            }
          }
        }
      }
    }
  }
}
\`\`\`

# Summary

Our real-time market statistics feature empowers you to create insightful data visualizations that help users understand market trends and make informed decisions. By leveraging granular filters, diverse statistics, and powerful aggregation capabilities, you can customize data to suit specific needs. For detailed documentation and further customization options, please refer to our [API Reference](https://docs.repliers.io/reference/getting-started-with-your-api).
`,
              },
             

            },
          },
        },
        required: [],
      },
    },
  },
};

export { repliersListingsSearchTool as apiTool };