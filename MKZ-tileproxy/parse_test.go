package main

import "testing"

func TestParseTilePath(t *testing.T) {
    tests := []struct {
        name    string
        path    string
        wantZ   int
        wantX   int
        wantY   int
        wantErr bool
    }{
        {
            name:    "valid 0/0/0",
            path:    "/tiles/0/0/0",
            wantZ:   0,
            wantX:   0,
            wantY:   0,
            wantErr: false,
        },
        {
            name:    "valid 7/65/43",
            path:    "/tiles/7/65/43",
            wantZ:   7,
            wantX:   65,
            wantY:   43,
            wantErr: false,
        },
        {
            name:    "valid 14/8703/5504",
            path:    "/tiles/14/8703/5504",
            wantZ:   14,
            wantX:   8703,
            wantY:   5504,
            wantErr: false,
        },
        {
            name:    "wrong prefix",
            path:    "/notiles/1/2/3",
            wantErr: true,
        },
        {
            name:    "too few segments",
            path:    "/tiles/1/2",
            wantErr: true,
        },
        {
            name:    "too many segments",
            path:    "/tiles/1/2/3/4",
            wantErr: true,
        },
        {
            name:    "non-numeric segment",
            path:    "/tiles/abc/1/1",
            wantErr: true,
        },
        {
            name:    "empty string",
            path:    "",
            wantErr: true,
        },
        {
            name:    "trailing slash only",
            path:    "/tiles/",
            wantErr: true,
        },
        {
            name:    "z too high",
            path:    "/tiles/23/0/0",
            wantErr: true,
        },
        {
            name:    "negative z",
            path:    "/tiles/-1/0/0",
            wantErr: true,
        },
        {
            name:    "x out of range",
            path:    "/tiles/1/2/0",
            wantErr: true,
        },
        {
            name:    "y out of range",
            path:    "/tiles/1/0/2",
            wantErr: true,
        },
        {
            name:    "negative x",
            path:    "/tiles/1/-1/0",
            wantErr: true,
        },
        {
            name:    "negative y",
            path:    "/tiles/1/0/-1",
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            gotZ, gotX, gotY, err := parseTilePath(tt.path)

            if tt.wantErr {
                if err == nil {
                    t.Fatalf("parseTilePath(%q) expected error, got nil", tt.path)
                }
                return
            }

            if err != nil {
                t.Fatalf("parseTilePath(%q) unexpected error: %v", tt.path, err)
            }

            if gotZ != tt.wantZ || gotX != tt.wantX || gotY != tt.wantY {
                t.Fatalf(
                    "parseTilePath(%q) = z=%d x=%d y=%d, want z=%d x=%d y=%d",
                    tt.path,
                    gotZ,
                    gotX,
                    gotY,
                    tt.wantZ,
                    tt.wantX,
                    tt.wantY,
                )
            }
        })
    }
}
