import heroBarber from "@/assets/hero-barber.jpg";
import groom from "@/assets/groom.png";
import lowFade from "@/assets/style-low-fade.jpg";
import frenchCrop from "@/assets/style-french-crop.jpg";
import messy from "@/assets/style-messy.jpg";
import quiff from "@/assets/style-quiff.jpg";
import midFade from "@/assets/style-mid-fade.jpg";
import buzz from "@/assets/style-buzz.jpg";
import salon1 from "@/assets/salon-1.jpg";
import salon2 from "@/assets/salon-2.jpg";
import salon3 from "@/assets/salon-3.jpg";
import salon4 from "@/assets/salon-4.jpg";

export const images = { heroBarber, groom };

export type Hairstyle = {
  slug: string;
  name: string;
  price: number;
  image: string;
  salons: number;
};

export const hairstyles: Hairstyle[] = [
  { slug: "low-fade", name: "Low Fade", price: 249, image: lowFade, salons: 42 },
  { slug: "french-crop", name: "French Crop", price: 249, image: frenchCrop, salons: 31 },
  { slug: "messy-hair", name: "Messy Hair", price: 199, image: messy, salons: 28 },
  { slug: "quiff-style", name: "Quiff Style", price: 249, image: quiff, salons: 25 },
  { slug: "mid-fade", name: "Mid Fade", price: 249, image: midFade, salons: 37 },
  { slug: "buzz-cut", name: "Buzz Cut", price: 199, image: buzz, salons: 44 },
];

export type Salon = {
  slug: string;
  name: string;
  area: string;
  city: string;
  pin: string;
  distanceKm: number;
  waiting: string;
  rating: number;
  reviews: number;
  open: boolean;
  startingPrice: number;
  image: string;
  services: string[];
  styles: string[];
};

export const salons: Salon[] = [
  {
    slug: "looks-salon",
    name: "Looks Salon",
    area: "Patia",
    city: "Bhubaneswar",
    pin: "751024",
    distanceKm: 2.4,
    waiting: "20-25 min",
    rating: 4.7,
    reviews: 412,
    open: true,
    startingPrice: 199,
    image: salon1,
    services: ["Haircut", "Beard", "Hair Spa", "Facial"],
    styles: ["Low Fade", "Buzz Cut", "Quiff Style"],
  },
  {
    slug: "modern-mens-salon",
    name: "Modern Men's Salon",
    area: "Kharvel Nagar",
    city: "Bhubaneswar",
    pin: "751001",
    distanceKm: 3.1,
    waiting: "15-20 min",
    rating: 4.6,
    reviews: 328,
    open: true,
    startingPrice: 249,
    image: salon2,
    services: ["Haircut", "Beard", "Hair Color", "Keratin"],
    styles: ["Mid Fade", "French Crop", "Messy Hair"],
  },
  {
    slug: "the-scissors-lounge",
    name: "The Scissors Lounge",
    area: "Saheed Nagar",
    city: "Bhubaneswar",
    pin: "751007",
    distanceKm: 3.5,
    waiting: "10-15 min",
    rating: 4.8,
    reviews: 256,
    open: true,
    startingPrice: 299,
    image: salon3,
    services: ["Haircut", "Facial", "Makeup", "Smoothening"],
    styles: ["Quiff Style", "Low Fade"],
  },
  {
    slug: "headmasters-salon",
    name: "Headmasters Salon",
    area: "Jayadev Vihar",
    city: "Bhubaneswar",
    pin: "751013",
    distanceKm: 4.2,
    waiting: "25-30 min",
    rating: 4.5,
    reviews: 189,
    open: false,
    startingPrice: 199,
    image: salon4,
    services: ["Haircut", "Hair Spa", "Beard", "Cleanup"],
    styles: ["Buzz Cut", "Mid Fade"],
  },
];

export const popularSearches = [
  "Bhubaneswar",
  "Patia",
  "751024",
  "Modern Salon",
  "Haircut",
  "Beard",
  "Hair Spa",
];

export const languages = [
  "English",
  "हिन्दी",
  "ଓଡ଼ିଆ",
  "বাংলা",
  "తెలుగు",
  "தமிழ்",
  "मराठी",
  "ಕನ್ನಡ",
  "മലയാളം",
  "ગુજરાતી",
  "ਪੰਜਾਬੀ",
];
