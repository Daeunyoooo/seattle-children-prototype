import { VERSION_B_LIBRARY_FILES, labelFromImageFile } from "./manifest.js";

import concernQ from "./questions/concern.png";
import dreamQ from "./questions/dream.png";
import healthyQ from "./questions/healthy.png";
import healthyFoodQ from "./questions/healthy_food.png";
import petQ from "./questions/pet.png";
import selfQ from "./questions/self.png";
import sportQ from "./questions/sport.png";
import studyQ from "./questions/study.png";
import sweetHomeQ from "./questions/sweet_home.png";
import worryQ from "./questions/worry.png";

import concernV from "./values/concern.png";
import dreamV from "./values/dream.png";
import healthyV from "./values/healthy.png";
import healthyFoodV from "./values/healthy_food.png";
import petV from "./values/pet.png";
import selfV from "./values/self.png";
import sportV from "./values/sport.png";
import studyV from "./values/study.png";
import sweetHomeV from "./values/sweet_home.png";
import worryV from "./values/worry.png";

const QUESTION_URLS = {
  "concern.png": concernQ,
  "dream.png": dreamQ,
  "healthy.png": healthyQ,
  "healthy_food.png": healthyFoodQ,
  "pet.png": petQ,
  "self.png": selfQ,
  "sport.png": sportQ,
  "study.png": studyQ,
  "sweet_home.png": sweetHomeQ,
  "worry.png": worryQ
};

const VALUES_URLS = {
  "concern.png": concernV,
  "dream.png": dreamV,
  "healthy.png": healthyV,
  "healthy_food.png": healthyFoodV,
  "pet.png": petV,
  "self.png": selfV,
  "sport.png": sportV,
  "study.png": studyV,
  "sweet_home.png": sweetHomeV,
  "worry.png": worryV
};

function buildLibrary(urlsByFile, folder) {
  return VERSION_B_LIBRARY_FILES.map((fileName) => ({
    id: `${folder}-${fileName}`,
    name: labelFromImageFile(fileName),
    fileName,
    url: urlsByFile[fileName],
    source: "seed"
  }));
}

export const VERSION_B_QUESTION_SEED_LIBRARY = buildLibrary(QUESTION_URLS, "questions");
export const VERSION_B_VALUES_SEED_LIBRARY = buildLibrary(VALUES_URLS, "values");
