export interface CustomProfileField {
  id: string;
  label: string;
  value: string;
}

export interface InstructorProfile {
  name: string;
  homeAddress: string;
  phone: string;
  email: string;
  customFields: CustomProfileField[];
}
