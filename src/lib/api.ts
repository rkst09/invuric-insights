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

export const fetchProjects = (filter: string) => {
  console.log("[API] fetchProjects called:", filter);
};

export const searchProjects = (query: string) => {
  console.log("[API] searchProjects called:", query);
};

export const openProjectDetail = (projectId: string) => {
  console.log("[API] openProjectDetail called:", projectId);
};

export const closeProjectDetail = () => {
  console.log("[API] closeProjectDetail called");
};

export const downloadDocument = (projectId: string, docType: string) => {
  console.log("[API] downloadDocument called:", projectId, docType);
};

export const previewDocument = (projectId: string, docType: string) => {
  console.log("[API] previewDocument called:", projectId, docType);
};

export const exportAllDocuments = (projectId: string) => {
  console.log("[API] exportAllDocuments called:", projectId);
};

export const continueProject = (projectId: string) => {
  console.log("[API] continueProject called:", projectId);
};

export const renameProject = (projectId: string) => {
  console.log("[API] renameProject called:", projectId);
};

export const duplicateProject = (projectId: string) => {
  console.log("[API] duplicateProject called:", projectId);
};

export const deleteProject = (projectId: string) => {
  console.log("[API] deleteProject called:", projectId);
};
