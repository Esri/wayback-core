# wayback-core
This package offers core functionalities to retrieve all versions of the World Imagery Wayback archive, or find versions that contain local changes. It is the underlying library used by the [Esri World Imagery Wayback App](https://github.com/Esri/wayback).

## Table of Contents
- [Installation](#installation)
- [API Documentation](#api-documentation)
  - [`getWaybackItems`](#getwaybackitems)
  - [`getWaybackItemsWithLocalChanges`](#getwaybackitemswithlocalchanges)
  - [`getMetadata`](#getmetadata)
  - [`getWaybackServiceBaseURL`](#getwaybackservicebaseurl)
  - [`setCustomWaybackConfig`](#setcustomwaybackconfig)
- [Type Definitions](#type-definitions)
  - [`WaybackItem`](#waybackitem)
  - [`WaybackMetadata`](#waybackmetadata)
- [Issues](#issues)
- [Contributing](#contributing)
- [Licensing](#licensing)

## Installation
Install the package using `npm` with the command below:

```sh
npm install @esri/wayback-core
```

## API Documentation

### `getWaybackItems`
Return a list of [`WaybackItem`](#waybackitem) for all World Imagery Wayback releases/versions from the Wayback archive. The output list is sorted by release date in descending order (newest release is the first item).

**Parameters**:  
_None_

**Returns**:
| Type          | Description                                                                                                                                                                        |
|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Promise<[WaybackItem](#waybackitem)[]> | When resolved, returns a list of [`WaybackItem`](#waybackitem) sorted by release date in descending order.|

**Example**:
```js
import {
    getWaybackItems,
} from '@esri/wayback-core';

const waybackItems = await getWaybackItems();
```

Here is an example of the response returned by `getWaybackItems()`:
```JS
[
    {
        "itemID":"f5f90c7419f24ceda396088f4e39ae83",
        "itemTitle":"World Imagery (Wayback 2023-12-07)",
        "itemURL":"https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/56102/{level}/{row}/{col}",
        "metadataLayerUrl":"https://metadata.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Metadata_2023_r11/MapServer",
        "metadataLayerItemID":"be19e857134046638a10dc2886a5398b",
        "layerIdentifier":"WB_2023_R11",
        "releaseNum":56102,
        "releaseDateLabel":"2023-12-07",
        "releaseDatetime": 1701936000000,
    },
    //...
]
```

### `getWaybackItemsWithLocalChanges`
Return a list of [`WaybackItem`](#waybackitem) with local changes for a specified geographic point at a given zoom level.

**Parameters**:
| Parameter                               | Type                                       | Required | Default | Description                                                                                                                      |
|-----------------------------------------|--------------------------------------------|----------|---------|----------------------------------------------------------------------------------------------------------------------------------|
| `point`                                 | `{ latitude: number; longitude: number; }` | Yes      | —       | The geographic coordinates (longitude and latitude) of the location of interest, (e.g., `{longitude: -100.05, latitude: 35.10}`) |
| `zoom`                                  | `number`                                   | Yes      | —       | The zoom level used to determine the level of detail for the geographic point                                                    |
| `options.signal`                        | `AbortSignal`                              | No       | —       | An `AbortSignal` to cancel the operation. If aborted, the function throws an error.                                              |
| `options.onlyUseSizeToFilterDuplicates` | `boolean`                                  | No       | `false` | When `true`, duplicate releases are filtered by tile size alone without fetching image data. This can significantly improve performance, but may cause some unique releases to be incorrectly excluded. |

**Returns**:
| Type          | Description                                                                                                                                                                        |
|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `Promise<`[`WaybackItem`](#waybackitem)`[]>` | When resolved, returns a list of [`WaybackItem`](#waybackitem) with local changes.|

**Example**:
```js
import { 
    getWaybackItemsWithLocalChanges 
} from '@esri/wayback-core';

const waybackItems = await getWaybackItemsWithLocalChanges(
    {
        longitude: 117.1825,
        latitude: 34.0556,
    },
    15
);
```

**Example with options**:
```js
const controller = new AbortController();

const waybackItems = await getWaybackItemsWithLocalChanges(
    {
        longitude: 117.1825,
        latitude: 34.0556,
    },
    15,
    {
        signal: controller.signal,
        onlyUseSizeToFilterDuplicates: true,
    }
);
```

Here is an example of the response returned by `getWaybackItemsWithLocalChanges()`:
```js
[
    {
        "itemID":"f5f90c7419f24ceda396088f4e39ae83",
        "itemTitle":"World Imagery (Wayback 2023-12-07)",
        "itemURL":"https://waybackdev.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/56102/{level}/{row}/{col}",
        "metadataLayerUrl":"https://metadatadev.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Metadata_2023_r11/MapServer",
        "metadataLayerItemID":"be19e857134046638a10dc2886a5398b",
        "layerIdentifier":"WB_2023_R11",
        "releaseNum":56102,
        "releaseDateLabel":"2023-12-07",
        "releaseDatetime": 1701936000000,
    },
    //...
]
```

### `getMetadata`
Query the wayback metadata feature service associated with the given wayback release/version to retrieve information (acquisition date, provider, resolution, etc.) of the world imagery wayback tile image at the specified location and zoom level.

**Parameters**:
| Parameter     | Type                                       | Description                                                                                                                      |
|---------------|--------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| Point         | `{ latitude: number; longitude: number; }` | The geographic coordinates (longitude and latitude) of the location of interest, (e.g., `{longitude: -100.05, latitude: 35.10}`) |
| Zoom          | number                                     | The zoom level                                                    |
| releaseNumber | number                                     | The release number of a given wayback release/version. (You can find the release number from the [`WaybackItem`](#waybackitem))                                                                                        |

**Returns**:
| Type          | Description                                                                                                                                                                        |
|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Promise<[`WaybackMetadata`](#waybackmetadata)> | When resolved, returns the [`WaybackMetadata`](#waybackmetadata) |

**Example**:
```js
import { getMetadata } from '@esri/wayback-core';

const metadata = await getMetadata(
    {
        longitude: 117.1825,
        latitude: 34.0556,
    },
    15,
    56102,
);
```

Here is an example of the response returned by `getMetadata()`:
```js
{
    "date": 1680307200000, 
    "provider": 'Maxar', 
    "source": 'WV03', 
    "resolution": 0.3, 
    "accuracy": 5
}
```

### `getWaybackServiceBaseURL`
Returns the base URL for the Wayback service, with a randomly selected subdomain.

**Parameters**:
_None_

**Returns**:
| Type   | Description                                                                 |
|--------|-----------------------------------------------------------------------------|
| string | The base URL for the Wayback service with a randomly selected subdomain.   |

**Example**:
```js
import { getWaybackServiceBaseURL } from '@esri/wayback-core';

const baseURL = getWaybackServiceBaseURL();
console.log(baseURL);
// Example output: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer"
```

### `setCustomWaybackConfig`
Configure custom wayback settings for testing or development purposes. This allows you to override the default Wayback configuration with custom subdomains, configuration file URLs, or configuration data.

**Parameters**:
| Parameter              | Type           | Description                                                                                                                                                                    |
|------------------------|----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| params.subDomains      | string[]       | (Optional) An array of custom subdomain names to use instead of the default production subdomains: `['wayback', 'wayback-a', 'wayback-b']`                                    |
| params.waybackConfigFileURL | string    | (Optional) A custom URL for the wayback configuration file to use instead of the default production URL: `https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json` |
| params.waybackConfigData | WaybackConfig | (Optional) Custom wayback configuration data to use directly, bypassing the need to fetch it from a configuration file URL                                                     |

**Returns**:
| Type | Description |
|------|-------------|
| void | This function does not return a value |

**Example**:
```js
import { setCustomWaybackConfig } from '@esri/wayback-core';

// Example 1: Set custom subdomains and configuration file URL
setCustomWaybackConfig({
    subDomains: ['custom-wayback-1', 'custom-wayback-2'],
    waybackConfigFileURL: 'https://example.com/custom-wayback-config.json'
});

// Example 2: Set custom configuration data directly
setCustomWaybackConfig({
    waybackConfigData: {
        '12345': {
            itemID: 'custom-item-id',
            itemTitle: 'World Imagery (Wayback 2024-01-15)',
            itemURL: 'https://custom.url/tile/12345/{level}/{row}/{col}',
            metadataLayerUrl: 'https://custom.metadata.url/MapServer',
            metadataLayerItemID: 'custom-metadata-id',
            layerIdentifier: 'WB_2024_R01',
        }
    }
});
```

## Type Definitions

### `WaybackItem`
Object that represents a specific release/version of the World Imagery Wayback archive.

**Usage**:
```js
import { WaybackItem } from '@esri/wayback-core';
```

**Properties**:
| Name                | Type   | Description                                                                                                                                                                     |
|---------------------|--------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| itemID              | string | Id of the ArcGIS Online Item (WMTS Layer) for this World Imagery Wayback release (e.g., `903f0abe9c3b452dafe1ca5b8dd858b9`)                                                    |
| itemTitle           | string | Title of this World Imagery Wayback release (e.g., `World Imagery (Wayback 2014-02-20)`)                                                                                       |
| itemURL             | string | URL template of the WMTS Layer for this Wayback release (e.g., `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/10/{level}/{row}/{col}`) |
| metadataLayerItemID | string | Id of the ArcGIS Online Item (Feature Layer) for the metadata of this World Imagery Wayback release (e.g., `73b47bbc112b498daf85d40fb972738a`)                                 |
| metadataLayerUrl    | string | URL of the metadata Feature Layer (e.g., `https://metadata.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Metadata_2014_r01/MapServer`)                                |
| layerIdentifier     | string | A unique identifier of this World Imagery Wayback Release (e.g., `WB_2014_R01`)                                                                                                |
| releaseNum          | number | Number of this Wayback release, which is being used as the time parameter in the itemURL: `/MapServer/tile/{releaseNum}/{level}/{row}/{col}`.                                  |
| releaseDateLabel    | string | Formatted release date for this Wayback item (e.g., `"2014-02-20"`)                                                                                                            |
| releaseDatetime     | number | Release date for this Wayback item as a Unix epoch timestamp (e.g., `1392883200000`)                                                                                           |


### `WaybackMetadata`
This object represents the metadata of a Wayback tile image.

**Usage**:
```js
import { WaybackMetadata } from '@esri/wayback-core';
```

**Properties**:
| Name       | Type   | Description                           |
|------------|--------|---------------------------------------|
| date       | number | Acquisition date of the image         |
| provider   | string | Provider of the image                 |
| source     | string | Source of the image                   |
| resolution | number | Ground distance that pixels represent |
| accuracy   | number | Number of meters objects are within   |

## Issues
Find a bug or want to request a new feature? Please let us know by submitting an issue.

## Contributing

Esri welcomes contributions from anyone and everyone. Please see our [guidelines for contributing](https://github.com/esri/contributing).

## Licensing

### The Imagery

The imagery presented in the Wayback Archive is subject to the terms and conditions set forth in the Esri Master Agreement or Terms of Use. See [World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) for additional details on the imagery content and applicable Terms of Use.

### The Software

Copyright 2023 Esri

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A copy of the license is available in the repository's [LICENSE](LICENSE) file.
