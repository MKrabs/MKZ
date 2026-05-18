package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

// Removes the old single geo_region relation field from kennzeichen.
// The correct model is the kennzeichen_geo_regions junction table (many-to-many),
// created in 1747500003_create_kennzeichen_geo_regions.go.
func init() {
    m.Register(func(app core.App) error {
        kennzeichen, err := app.FindCollectionByNameOrId("kennzeichen")
        if err != nil {
            return err
        }
        field := kennzeichen.Fields.GetByName("geo_region")
        if field == nil {
            return nil // already removed
        }
        kennzeichen.Fields.RemoveById(field.GetId())
        return app.Save(kennzeichen)
    }, func(app core.App) error {
        kennzeichen, err := app.FindCollectionByNameOrId("kennzeichen")
        if err != nil {
            return err
        }
        geoRegions, err := app.FindCollectionByNameOrId("geo_regions")
        if err != nil {
            return err
        }
        kennzeichen.Fields.Add(&core.RelationField{
            Name:          "geo_region",
            Required:      false,
            CollectionId:  geoRegions.Id,
            MaxSelect:     1,
            CascadeDelete: false,
        })
        return app.Save(kennzeichen)
    })
}
