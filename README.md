# **datacanvas**

[Datacanvas](https://datacanvas.dev) is a proof-of-concept, open-source, MIT-licensed web application for visual, interactive creation and editing of 2D, 2.5D and 3D data visualizations. 

## Source Structure

This repository is structured as follows:

| Directory                                         | Description                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `/`                                               | TypeScript and GLSL source code files for the web-based visualization creation tool  |
| [`lib/headless-renderer`](/lib/headless-renderer) |  Source code files for the headless, server-side rendering of visualizations         |

For instructions about the individual components and their setup, view the respective README files of the directories.

![License](https://img.shields.io/github/license/bakoe/datacanvas.svg?logo=coveralls)

---

# **datacanvas** › Web-based visualization editor

This directory contains the TypeScript and GLSL source code files for the web-based visualization creation tool [datacanvas](https://datacanvas.dev).

## Setup Instructions

The web-based tool is written in TypeScript and bundled using Vite/Rollup to allow for static serving of the resulting assets, i.e., the HTML, JS, and image files. 

Thus, make sure to have Node.js installed on your system and install the project’s dependencies using the following command:

```bash
npm install
```

## NPM Configuration and Project Setup

`package.json` specifies the following scripts that can be run by `npm run <command>`.

| command         | description                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `build`         | builds the tool for deployment, creating a bundle with all facilities                                                 |
| `dev`           | starts a local development server serving the tool on port 3000                                                       |
| `format`        | auto-formats the source code using [Prettier](https://prettier.io)                                                    |
| `lint`          | performs code quality linting using [TypeScript ESLint Rules](https://github.com/typescript-eslint/typescript-eslint) |
| `preview`       | locally previews the production build created via `npm run build`                                                     |

## Deployment

The tool is deployed using [Vercel](https://vercel.com). You can use the [Vercel CLI](https://vercel.com/docs/cli) to serve an instance of datacanvas, including the redirects set-up via the `vercel.json` file.
