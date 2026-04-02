// API placeholder stubs — marks every backend touchpoint
export const fetchRecentProjects = () => {
  console.log("[API] fetchRecentProjects called");
};

export const startFullPipeline = () => {
  console.log("[API] startFullPipeline called");
};

export const openModule = (moduleId: string) => {
  console.log("[API] openModule called:", moduleId);
};

export const downloadProject = (projectId: string) => {
  console.log("[API] downloadProject called:", projectId);
};

export const openProject = (projectId: string) => {
  console.log("[API] openProject called:", projectId);
};

export const selectDocumentType = (type: string) => {
  console.log("[API] selectDocumentType called:", type);
};

export const continueToNextStep = (type: string) => {
  console.log("[API] continueToNextStep called:", type);
};

export const openDocumentGuide = () => {
  console.log("[API] openDocumentGuide called");
};

export const navigateBack = () => {
  console.log("[API] navigateBack called");
};
