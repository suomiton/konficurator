/**
 * This is a mock implementation of persistence.js
 * We completely override the saveFile method to handle the mocks
 */

export class FilePersistence {
  constructor() {
    this.wasmInitialized = false;
  }

  async ensureWasmInitialized() {
    this.wasmInitialized = true;
    return Promise.resolve();
  }

  /**
   * Mock implementation of extractFormData for testing
   * @param {HTMLFormElement} formElement 
   * @returns {Object} Extracted form data
   */
  extractFormData(formElement) {
    const result = {};
    const formData = new FormData(formElement);
    
    // Process each form field
    for (const [fieldPath, value] of formData.entries()) {
      const path = fieldPath.split('.');
      this.setNestedValue(result, path, value);
    }
    
    // Process checkboxes
    const checkboxes = formElement.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((element) => {
      const checkbox = element;
      const fieldPath = checkbox.name;
      const path = fieldPath.split('.');
      const value = checkbox.checked ? "true" : "false";
      this.setNestedValue(result, path, value);
    });
    
    return result;
  }
  
  /**
   * Helper method to set a nested value
   */
  setNestedValue(obj, path, value) {
    let current = obj;
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      if (i === path.length - 1) {
        // Last key, set the value
        current[key] = value;
      } else {
        // Create the object if it doesn't exist
        if (!current[key] || typeof current[key] !== "object") {
          current[key] = {};
        }
        current = current[key];
      }
    }
  }
  
  /**
   * Mock implementation of saveFile for testing
   * The actual implementation will be provided by the test
   */
  async saveFile(fileData, formElement) {
    return Promise.resolve();
  }
}

export default FilePersistence;
