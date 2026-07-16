export interface CustomProfileField {
  id: string;
  label: string;
  value: string;
}

export interface InstructorProfile {
  id?: string;
  user_id?: string;
  name: string;
  homeAddress: string;
  phone: string;
  email: string;
  customFields: CustomProfileField[];
}
