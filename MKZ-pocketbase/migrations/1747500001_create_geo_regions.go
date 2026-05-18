package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		collection := core.NewBaseCollection("geo_regions")

		// Public read, no writes from outside (seeded via migration only).
		collection.ListRule = types.Pointer("")
		collection.ViewRule = types.Pointer("")
		collection.CreateRule = nil
		collection.UpdateRule = nil
		collection.DeleteRule = nil

		collection.Fields.Add(
			// ags — Amtlicher Gemeindeschlüssel, e.g. "01001"
			&core.TextField{
				Name:     "ags",
				Required: true,
				Max:      20,
			},
			// gen — human-readable district name, e.g. "Flensburg"
			&core.TextField{
				Name:     "gen",
				Required: true,
				Max:      200,
			},
			// low — compact GeoJSON geometry for fast map rendering
			&core.JSONField{
				Name:     "low",
				Required: false,
			},
			// high — full-detail GeoJSON geometry for zoomed-in rendering
			&core.JSONField{
				Name:     "high",
				Required: false,
			},
		)

		collection.AddIndex("idx_geo_regions_ags", true,  "ags", "")
		collection.AddIndex("idx_geo_regions_gen", false, "gen", "")

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("geo_regions")
		if err != nil {
			return nil // already gone
		}
		return app.Delete(collection)
	})
}
