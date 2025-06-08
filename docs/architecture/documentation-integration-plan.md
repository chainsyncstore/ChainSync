site_name: ChainSync Documentation
site_description: Comprehensive documentation for the ChainSync retail chain management system
site_author: ChainSync Development Team
repo_url: https://github.com/chainsync/chainsyncmanager
repo_name: chainsync/chainsyncmanager

theme:
name: material
palette:
primary: indigo
accent: deep purple
features: - navigation.instant - navigation.tracking - navigation.expand - navigation.indexes - navigation.top - search.highlight - search.share - content.code.copy - content.tabs.link

markdown_extensions:

- admonition
- attr_list
- def_list
- footnotes
- meta
- toc:
  permalink: true
- pymdownx.highlight:
  anchor_linenums: true
- pymdownx.inlinehilite
- pymdownx.snippets
- pymdownx.superfences:
  custom_fences: - name: mermaid
  class: mermaid
  format: !!python/name:pymdownx.superfences.fence_code_format
- pymdownx.tabbed:
  alternate_style: true
- pymdownx.tasklist:
  custom_checkbox: true

plugins:

- search
- minify:
  minify_html: true
- git-revision-date-localized:
  type: date
- mkdocstrings:
  handlers:
  typescript:
  selection:
  filters: - "!^_" # exclude all members starting with _

nav:

- Home: index.md
- Architecture:
  - Overview: architecture/overview.md
  - Components:
    - Authentication: architecture/components/authentication.md
    - Inventory Management: architecture/components/inventory-management.md
    - Performance Optimization: architecture/components/performance-optimization.md
    - Reliability & Resilience: architecture/components/reliability-resilience.md
  - Decision Records:
    - Service Standardization Pattern: architecture/adrs/001-service-standardization-pattern.md
    - Redis for Token Storage: architecture/adrs/002-redis-for-token-storage.md
    - Resilience Patterns: architecture/adrs/003-resilience-patterns.md
    - Database Connection Pooling: architecture/adrs/004-database-connection-pooling.md
- Guides:
  - Developer Onboarding: guides/developer-onboarding.md
  - Service Implementation: guides/service-implementation.md
- API Reference:
  - Overview: api/overview.md
- Operations:
  - Deployment: operations/deployment.md

extra:
social: - icon: fontawesome/brands/github
link: https://github.com/chainsync/chainsyncmanager
version:
provider: mike
