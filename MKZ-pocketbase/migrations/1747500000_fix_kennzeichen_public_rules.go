// Migration 1747500000_fix_kennzeichen_public_rules
//
// Ensures the `kennzeichen` collection is publicly readable (list + view)
// without requiring authentication.
//
// Symptom fixed: anonymous lookupCode("KA") returned an empty result-set
// (totalItems: -1) because the ListRule had drifted to a non-public value
// in the live instance (e.g. changed via the admin dashboard).
//
// After this migration:
//   ListRule  = ""  → anyone can list/filter
//   ViewRule  = ""  → anyone can view a single record
//   CreateRule = nil → admin-only (data is seeded, not user-created)
//   UpdateRule = nil → admin-only
//   DeleteRule = nil → admin-only
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("kennzeichen")
		if err != nil {
			return err
		}

		// Empty string = anyone can access (public).
		// nil = admin only.
		empty := ""
		collection.ListRule = types.Pointer(empty)
		collection.ViewRule = types.Pointer(empty)
		collection.CreateRule = nil
		collection.UpdateRule = nil
		collection.DeleteRule = nil

		return app.Save(collection)
	}, func(app core.App) error {
		// Down: restore to admin-only (safe fallback — re-seed restores data)
		collection, err := app.FindCollectionByNameOrId("kennzeichen")
		if err != nil {
			return err
		}

		collection.ListRule = nil
		collection.ViewRule = nil

		return app.Save(collection)
	})
}
