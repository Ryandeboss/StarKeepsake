-- StarKeepsake M1: run ONCE in the dedicated Azure SQL database (for example, starkeepsake-dev).
-- Does not modify Etsy data or other application databases.
IF OBJECT_ID(N'dbo.CustomerDesigns', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerDesigns
    (
        DesignId NVARCHAR(24) NOT NULL
            CONSTRAINT PK_CustomerDesigns PRIMARY KEY,
        AccessKeyHash VARBINARY(32) NOT NULL,
        CreatedUtc DATETIME2(3) NOT NULL
            CONSTRAINT DF_CustomerDesigns_CreatedUtc DEFAULT SYSUTCDATETIME(),
        DesignJson NVARCHAR(MAX) NOT NULL,
        PreferencesJson NVARCHAR(MAX) NOT NULL,
        OriginalMime VARCHAR(24) NOT NULL,
        ForegroundMime VARCHAR(24) NULL,
        CONSTRAINT CK_CustomerDesigns_DesignJson CHECK (ISJSON(DesignJson) = 1),
        CONSTRAINT CK_CustomerDesigns_PreferencesJson CHECK (ISJSON(PreferencesJson) = 1),
        CONSTRAINT CK_CustomerDesigns_DesignId
            CHECK (DesignId LIKE 'SK-%' AND LEN(DesignId) = 19),
        CONSTRAINT CK_CustomerDesigns_OriginalMime
            CHECK (OriginalMime IN ('image/jpeg','image/png','image/webp')),
        CONSTRAINT CK_CustomerDesigns_ForegroundMime
            CHECK (ForegroundMime IS NULL OR ForegroundMime = 'image/png')
    );
    CREATE INDEX IX_CustomerDesigns_CreatedUtc ON dbo.CustomerDesigns(CreatedUtc DESC);
END;
