package uv

func GetUVIndex(uv float64) string {
	switch {
	case uv < 3:
		return "Low"
	case uv < 6:
		return "Moderate"
	case uv < 8:
		return "High"
	case uv < 11:
		return "Very High"
	default:
		return "Extreme"
	}
}
