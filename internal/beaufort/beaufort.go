package beaufort

func ToBeaufort(windSpeed float64) (int, string) {
	switch {
	case windSpeed < 0.3:
		return 0, "Calm"
	case windSpeed < 1.6:
		return 1, "Light air"
	case windSpeed < 3.4:
		return 2, "Light breeze"
	case windSpeed < 5.5:
		return 3, "Gentle breeze"
	case windSpeed < 8.0:
		return 4, "Moderate breeze"
	case windSpeed < 10.8:
		return 5, "Fresh breeze"
	case windSpeed < 13.9:
		return 6, "Strong breeze"
	case windSpeed < 17.2:
		return 7, "Near gale"
	case windSpeed < 20.8:
		return 8, "Gale"
	case windSpeed < 24.5:
		return 9, "Strong gale"
	case windSpeed < 28.5:
		return 10, "Storm"
	case windSpeed < 32.7:
		return 11, "Violent storm"
	default:
		return 12, "Hurricane"
	}
}
