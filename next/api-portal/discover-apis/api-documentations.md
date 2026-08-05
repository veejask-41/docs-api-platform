---
title: "View API documentation in the API Portal & MCP Hub"
description: "Read an API's specification, try its operations from the browser, and open the guides its publisher attached, on the documentation page."
canonical_url: https://wso2.com/api-platform/docs/cloud/api-portal/discover-apis/api-documentations/
md_url: https://wso2.com/api-platform/docs/cloud/api-portal/discover-apis/api-documentations.md
tags:
  - cloud
  - api-portal
  - discover-apis
author: WSO2 API Platform Documentation Team
last_updated: 2026-07-31
content_type: "how-to"
---

# API documentation

The documentation page holds everything the publisher wrote about an API: its full specification, an interactive console for calling operations, and any guides attached alongside. Where the [overview page](api-overview.md) summarizes the API, this is where you work out how to call it.

## Open the documentation page

1. Go to **APIs** in the sidebar and open the API you want.
2. Click **Documentation** in the header, or select **Documentation** under **APIs** in the sidebar.

    ![](../../../assets/img/standalone-devportal/discover-apis/api-documentations/menu-api-doc.png){style="max-width:250px;"}

The page opens on the API's specification. A navigation pane on the left lists everything else available.

!!! note
    SOAP APIs have no **Documentation** button. Their overview page offers a **Download** button for the WSDL file instead.

## Navigate the documentation

The left pane groups entries under a heading per section:

- **SPECIFICATION** holds the API's own specification, listed as **API Definition** (or **MCP Playground** for an MCP server). For WebSocket, WebSub, and GraphQL APIs it also holds **Tryout**, which opens the same specification in an interactive client.
- One group per document type the publisher used, such as **Other**, listing each attached document by name.

Select any entry to load it in the content pane on the right. A badge above the content names the file you're reading, such as `openapi.yaml` or `getting-started.md`.

## Read the API specification

**API Definition** renders the specification in a viewer chosen for the API type:

| API type | Viewer | What you can do |
|---|---|---|
| REST | OpenAPI reference | Read every operation, parameter, and response schema, and call operations from the built-in **Try It** console |
| GraphQL | Schema viewer | Browse types, queries, and mutations. **Tryout** opens GraphiQL, with an endpoint selector and fields for an OAuth2 token or API key |
| WebSocket, WebSub | AsyncAPI viewer | Read the channels and message payloads. **Tryout** opens a client that connects to the endpoint |
| MCP server | MCP Playground | Inspect the server's tools and invoke them with a bearer token |

The **Try It** console on a REST API calls the endpoint straight from your browser, so the API's gateway has to return CORS headers for the portal's origin. Supply every credential the operation requires, the same way your client would: an `Authorization: Bearer` header for OAuth2, the API key header for key-secured APIs, and—where the API declares one—the subscription header its specification names.

## Read an attached document

Publishers attach guides to an API to cover what a specification can't express—authentication walkthroughs, worked examples, known limitations. Select a document in the left pane to read it.

An attached document renders in the content pane, as in this example covering a token-based subscription:

![Attached document showing an authentication headers table, a subscription plans table, and numbered steps for consuming the API](../../../assets/img/standalone-devportal/discover-apis/api-documentations/api-doc-md.png)

Every document is also served as raw Markdown for AI agents. See [AI Agent Discovery](ai-agent-discovery.md) for the endpoints.

## Related

- [Search APIs](api-search.md): find the API you want to view
- [API Overview](api-overview.md): endpoints, resources, and subscription plans at a glance
- [Consume an API Secured with OAuth2](../consume-an-api/oauth2.md): get a token before using the try-out console
- [Consume an API Secured with an API Key](../consume-an-api/api-key.md)