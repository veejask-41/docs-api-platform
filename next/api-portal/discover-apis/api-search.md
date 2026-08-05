---
title: "Search APIs in the API Portal & MCP Hub"
description: "Browse and search published APIs in the API Portal & MCP Hub by name, version, type, description, tags, or documentation content."
canonical_url: https://wso2.com/api-platform/docs/cloud/api-portal/discover-apis/api-search/
md_url: https://wso2.com/api-platform/docs/cloud/api-portal/discover-apis/api-search.md
tags:
  - cloud
  - api-portal
  - discover-apis
author: WSO2 API Platform Documentation Team
last_updated: 2026-07-31
content_type: "how-to"
---

# Search APIs

The API listing page is where you browse everything published to the API Portal & MCP Hub and narrow it down to the API you need.

## Browse the API listing

Click **APIs** in the sidebar. The listing page shows a card for every published API, above a count of how many are listed.

The listing shows one card per API, with the search bar above it:

![API listing page with a search bar and four API cards, each showing type badges, tags, plan count, and a Subscribe button](../../../assets/img/standalone-devportal/discover-apis/api-search/api-listing-page.png)

Each card shows:

- The API's icon (or its initials), name, and version
- A **Type** badge: REST, GraphQL, WebSocket, WebSub, or SOAP
- An **AI Ready** badge when the API is visible to AI agents, and a **Deprecated** badge when the API has been deprecated
- The description, and any tags the publisher added
- The number of subscription plans and a **Subscribe** button, when the API has plans
- A **Subscribed** ribbon, when you already hold a subscription to the API

Click a card to open the API's [overview page](api-overview.md).

Model Context Protocol (MCP) servers are listed separately. Click **MCP Servers** in the sidebar to browse them the same way.

!!! note
    A listing covers one [view](../admin-settings/manage-views.md), and an API appears in it only if one of the API's labels is mapped to that view. If an API you expect is missing, ask your portal admin to check its labels.

## Search for an API

1. Type a term into the search bar at the top of the listing page.
2. Press <kbd>Enter</kbd>.

The page reloads with your term applied as a `query` parameter, and the results bar reports how many APIs matched. To return to the full listing, clear the search bar and press <kbd>Enter</kbd> again.

![Search bar with "Naviga" query returning a single matching APIs count of 1 and the Navigation API WebSocket card](../../../assets/img/standalone-devportal/discover-apis/api-search/search-result.png)

### What a search term matches

A search takes one free-text term rather than a set of separate fields. Which fields it compares that term against depends on the database the portal runs on—see the per-database differences below.

| Matched against | Example |
|---|---|
| Name | `Navigation` finds the Navigation API |
| Version | `v3.5` finds every API published at that version |
| Description | `catalog` finds any API described as a catalog |
| Type | `RestApi` finds the REST APIs |
| Tags | `finance` finds every API tagged `finance` |
| Attached documents and the API specification | `webhook` finds an API whose getting-started guide mentions webhooks |

Two details depend on which database backs your deployment:

- **PostgreSQL** searches attached documents and the API specification alongside the metadata, and matches whole words and their grammatical variants through English full-text search.
- **SQLite** (the default) and **SQL Server** search the metadata and tags only, and match substrings, so `Naviga` finds the Navigation API.

## Related

- [API Overview](api-overview.md): open an API's card to see its endpoints, resources, and subscription plans
- [API Documentation](api-documentations.md): full endpoint, schema, and security details
- [Manage Views](../admin-settings/manage-views.md): how admins decide which APIs a view lists