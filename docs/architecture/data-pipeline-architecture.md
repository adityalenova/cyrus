# Data Pipeline Architecture

## Overview
Cyrus aggregates thousands of open-source programs and repository issues via automated crawl scripts located in `scripts/`.

## Pipeline Stages
1. **Fetch**: GitHub GraphQL API queries for open issues, stars, and language stats.
2. **Transform**: Normalizes issue metadata, difficulty labels, and program affiliations.
3. **Prerender**: Outputs optimized JSON shards into `public/data/`.
