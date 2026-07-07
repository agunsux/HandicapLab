# Feature Manifest

Dokumen ini melacak semua *feature* yang dihitung dan digunakan di dalam *Quant Research Platform*.

| Feature Name | Type | Description | Owner | Version | Safe from Leakage? | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `odds_home` | Raw | Bookmaker closing odds for home team | Data Eng | v1.0 | ✅ Yes | None |
| `odds_draw` | Raw | Bookmaker closing odds for draw | Data Eng | v1.0 | ✅ Yes | None |
| `odds_away` | Raw | Bookmaker closing odds for away team | Data Eng | v1.0 | ✅ Yes | None |
| `prob_home_bookie_true` | Derived | Vigorish-removed implied probability | Quant | v1.0 | ✅ Yes | `odds_*` |

*(Tambahkan fitur baru ke daftar ini ketika Feature Engineering di EXP-002+ dimulai)*
