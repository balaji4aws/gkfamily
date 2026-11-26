# GK Kistappa Family Tree

A static family-tree web app. Anyone can view the tree; only the owner can edit
it, from any device, with no server to run.

## What it does

- Shows the family as a tree of cards: **name, photo, and location**.
- **Phone numbers are stored but never shown** on the page — they are kept in the
  data only for the owner's reference.
- Search by name or place; zoom and pan the tree.
- Owner editing: add a person, edit anyone, or delete, through a simple form
  (name, gender, parent, spouse name, location, phone, photo upload).

## How it is built

- Plain static files — `index.html`, `styles.css`, `app.js` — hostable on any
  static host (GitHub Pages, etc.). No backend, no database.
- The whole family is one flat list in `family.json`. Every person has an `id`
  and a `parentId` pointing at their parent, so the tree is rebuilt in the
  browser. A flat list means adding one person can never break the structure.
- Photos live in `img/` and are named after each person's `id`.

## Editing (owner only)

Editing commits changes straight to this repository from the browser using a
GitHub personal access token that is saved only in the owner's browser.

1. Open the site, click **Set up editing** (or the ⚙ button).
2. Enter the GitHub username, repository, branch, and a fine-grained personal
   access token with **Contents: Read and write** on this repository only.
3. Editing turns on. **+ Add** and per-card **Edit**/**Delete** now work; each
   save is a commit.

The token stays in local browser storage on that device. Signing out removes it.

## Data shape

```json
{
  "id": "p12",
  "parentId": "p3",
  "name": "Full Name",
  "gender": "male",
  "photo": "img/p12.jpg",
  "spouseName": "Spouse Name",
  "location": "City",
  "phone": ""
}
```
