# LENIXVISION — Product Explorer

A standalone interactive smart-glasses inspector. The landing page and internship story chapters have been removed at the user's request.

## Run

Requires Node.js 22.12+ or a compatible current release.

```sh
npm install
npm run dev
npm run build
npm run preview
```

The static production build is generated in `dist/`.

## Controls

Drag the glasses to orbit. Select front, side, or three-quarter camera views. Toggle slow rotation, component labels, the exploded view, material visualization, wireframe, and articulated temples. Select any of the six components to inspect its role. Reset the camera from the header, or reset every control from the sidebar.

The layout adapts to mobile and respects reduced-motion preferences. An original SVG illustration remains available if WebGL cannot initialize.

## Source

- `src/App.tsx`: standalone page entry.
- `src/components/ProductInspector.tsx`: inspector controls, selection, and responsive interface.
- `src/components/SmartGlassesModel.tsx`: original procedural geometry, component animation, and projected labels.
- `src/components/SmartGlassesScene.tsx`: lighting, rendering lifecycle, camera controls, and fallback.
- `src/components/inspector.css`: inspector layout and visual design.

## Concept and asset provenance

The glasses are an original conceptual visualization, not a verified reproduction of Lenixvision hardware. No authentic product photographs, specifications, or models were supplied. No claims of actual component placement, hardware validation, or device performance are implied.

All geometry and SVG illustrations are authored in this project. Fonts are self-hosted through Fontsource: Inter and Space Grotesk use the SIL Open Font License. Lucide icons use the ISC license. No external textures, company logo files, or third-party 3D models are used.

## Hosting

The existing private Sites project ID is retained in `.openai/hosting.json`. Source synchronization could not proceed because the Sites service returned `Sites project not found` for that registered ID. The local preview and static production output work independently of that service.
