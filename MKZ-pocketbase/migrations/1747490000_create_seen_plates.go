package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// 1747490000_create_seen_plates creates the `seen_plates` collection.
// Each row records a user having "spotted" a particular plate prefix (Kennzeichen code).
// The unique index on (user, plate_code) guarantees one entry per user per region.
func init() {
	m.Register(func(app core.App) error {
		usersCollection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		collection := core.NewBaseCollection("seen_plates")

		// Only the owner can read/write their own plates
		collection.ListRule   = types.Pointer("@request.auth.id = user.id")
		collection.ViewRule   = types.Pointer("@request.auth.id = user.id")
		collection.CreateRule = types.Pointer(
			"@request.auth.id != '' && @request.body.user = @request.auth.id",
		)
		collection.UpdateRule = types.Pointer("@request.auth.id = user.id")
		collection.DeleteRule = types.Pointer("@request.auth.id = user.id")

		collection.Fields.Add(
			&core.RelationField{
				Name:          "user",
				Required:      true,
				CollectionId:  usersCollection.Id,
				CascadeDelete: true,
			},
			// The 1-3 letter plate prefix, e.g. "M", "KA", "B"
			&core.TextField{
				Name:     "plate_code",
				Required: true,
				Max:      3,
			},
			// The full plate text as typed by the user, e.g. "M AB 1234"
			&core.TextField{
				Name:     "plate_text",
				Required: true,
				Max:      30,
			},
			// Auto-set on creation
			&core.AutodateField{
				Name:     "noted_at",
				OnCreate: true,
			},
		)

		// One "found" entry per user per region
		collection.AddIndex("idx_seen_plates_user_code_unique", true, "user, plate_code", "")

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("seen_plates")
		if err != nil {
			return err
		}
		return app.Delete(collection)
	})
}
