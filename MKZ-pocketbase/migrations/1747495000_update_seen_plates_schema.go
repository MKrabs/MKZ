package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// 1747495000_update_seen_plates_schema rebuilds the `seen_plates` collection:
//   - `plate_code` (string) → `kennzeichen` (relation to kennzeichen collection)
//   - adds `image` (optional single-file field)
//   - unique constraint is now on (user, plate_text), NOT (user, plate_code),
//     allowing a user to log multiple distinct plate texts from the same region
//     (e.g. "KA" and "KA NR 355" are two separate entries).
func init() {
	m.Register(func(app core.App) error {
		// 1. Drop the old schema (no real user data yet)
		old, err := app.FindCollectionByNameOrId("seen_plates")
		if err == nil {
			if err := app.Delete(old); err != nil {
				return err
			}
		}

		// 2. Resolve referenced collections
		usersCol, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		kzCol, err := app.FindCollectionByNameOrId("kennzeichen")
		if err != nil {
			return err
		}

		// 3. Build the new collection
		col := core.NewBaseCollection("seen_plates")

		col.ListRule   = types.Pointer("@request.auth.id = user.id")
		col.ViewRule   = types.Pointer("@request.auth.id = user.id")
		col.CreateRule = types.Pointer(
			"@request.auth.id != '' && @request.body.user = @request.auth.id",
		)
		col.UpdateRule = types.Pointer("@request.auth.id = user.id")
		col.DeleteRule = types.Pointer("@request.auth.id = user.id")

		col.Fields.Add(
			// Owner — cascade-delete their plates when the user account is removed
			&core.RelationField{
				Name:          "user",
				Required:      true,
				CollectionId:  usersCol.Id,
				CascadeDelete: true,
			},
			// Region — relation to the authoritative kennzeichen record
			// No cascade: deleting a kennzeichen is extremely unlikely and
			// should not silently wipe a user's spotting history.
			&core.RelationField{
				Name:          "kennzeichen",
				Required:      true,
				CollectionId:  kzCol.Id,
				CascadeDelete: false,
			},
			// The exact text the user typed/confirmed, e.g. "KA NR 355"
			&core.TextField{
				Name:     "plate_text",
				Required: true,
				Max:      30,
			},
			// Optional proof photo (single file, images only, max 5 MB)
			&core.FileField{
				Name:      "image",
				Required:  false,
				MaxSelect: 1,
				MaxSize:   5 * 1024 * 1024,
				MimeTypes: []string{
					"image/jpeg",
					"image/png",
					"image/webp",
					"image/gif",
				},
			},
			// Automatically set on creation
			&core.AutodateField{
				Name:     "noted_at",
				OnCreate: true,
			},
		)

		// One entry per exact plate text per user
		col.AddIndex("idx_seen_plates_user_text_unique", true, "user, plate_text", "")

		return app.Save(col)
	}, func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("seen_plates")
		if err != nil {
			return err
		}
		return app.Delete(col)
	})
}
