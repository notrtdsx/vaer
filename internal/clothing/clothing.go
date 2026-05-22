package clothing

import "fmt"

func GetClothingAdvice(temp, wind, precip, humidity, uv float64) string {
	advice := "Clothing advice:\n"

	switch {
	case temp < 0:
		advice += "- Very cold: Wear a heavy winter coat, gloves, a hat, and a scarf.\n"
	case temp < 10:
		advice += "- Cold: A warm jacket or coat is recommended.\n"
	case temp < 20:
		advice += "- Mild: A light jacket or sweater should be sufficient.\n"
	default:
		advice += "- Warm: Light clothing, such as a t-shirt and shorts, is appropriate.\n"
	}

	if wind > 10 {
		advice += "- Windy: Consider a windbreaker.\n"
	}

	if precip > 0 {
		advice += "- Rainy: Don't forget your umbrella or a waterproof jacket.\n"
	}

	if humidity > 70 {
		advice += "- Humid: Wear light, breathable fabrics.\n"
	}

	if uv >= 8 {
		advice += "- High UV Index: Protect your skin with sunscreen, a hat, and sunglasses.\n"
	}

	return advice
}
