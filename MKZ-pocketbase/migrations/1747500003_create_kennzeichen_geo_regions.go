package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
    "github.com/pocketbase/pocketbase/tools/types"
)

// Creates the kennzeichen_geo_regions junction table.
// A single kennzeichen can map to multiple geo_regions (e.g. KA → Stadt Karlsruhe
// AND Landkreis Karlsruhe), and a geo_region can be shared by multiple kennzeichen.
func init() {
    m.Register(func(app core.App) error {
        kennzeichen, err := app.FindCollectionByNameOrId("kennzeichen")
        if err != nil {
            return err
        }
        geoRegions, err := app.FindCollectionByNameOrId("geo_regions")
        if err != nil {
            return err
        }

        collection := core.NewBaseCollection("kennzeichen_geo_regions")

        // Public read, no writes from outside — managed via migrations/admin only.
        collection.ListRule = types.Pointer("")
        collection.ViewRule = types.Pointer("")
        collection.CreateRule = nil
        collection.UpdateRule = nil
        collection.DeleteRule = nil

        collection.Fields.Add(
            &core.RelationField{
                Name:          "kennzeichen",
                Required:      true,
                CollectionId:  kennzeichen.Id,
                MaxSelect:     1,
                CascadeDelete: true, // if kennzeichen deleted, remove junction rows
            },
            &core.RelationField{
                Name:          "geo_region",
                Required:      true,
                CollectionId:  geoRegions.Id,
                MaxSelect:     1,
                CascadeDelete: true, // if geo_region deleted, remove junction rows
            },
        )

        // Unique constraint — no duplicate (kennzeichen, geo_region) pairs.
        collection.AddIndex(
            "idx_kz_geo_unique",
            true,
            "kennzeichen, geo_region",
            "",
        )
        // Fast lookup by kennzeichen.
        collection.AddIndex(
            "idx_kz_geo_kennzeichen",
            false,
            "kennzeichen",
            "",
        )

        return app.Save(collection)
    }, func(app core.App) error {
        collection, err := app.FindCollectionByNameOrId("kennzeichen_geo_regions")
        if err != nil {
            return nil // already gone
        }
        return app.Delete(collection)
    })
}
