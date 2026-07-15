export interface StudentModel {
  id: number;
  student_name: string;
  student_id: string;
  nric: string;
  email: string;
  balance: number;
  password: string;
  register_date: number;
  complete_date: number;
  date_update: number;
  month_credit: string;
  status: string;
  last_password_change: number;
  firstTime: string;
  intake: string;
  course_code: string;
  campus: string;
  must_change_password: boolean;
}

export interface AddStudent {
  student_name: string;
  student_id: string;
  nric: string;
  email: string;
  balance: number;
  password: string;
  register_date: number;
  complete_date: number;
  date_update: number;
  month_credit: string;
  status: string;
  last_password_change: string;
  firstTime: string;
  intake: string;
  course_code: string;
  campus: string;
}

export interface SubmitStudent {
  student_name: string;
  student_id: string;
  nric: string;
  email: string;
  register_date: number;
  complete_date: number;
  intake: string;
  course_code: string;
  campus: string;
}

export interface UpdateStudent {
  student_name: string;
  student_id: string;
  nric: string;
  email: string;
  balance: number;
  password: string;
  register_date: number;
  complete_date: number;
  date_update: number;
  month_credit: string;
  status: string;
  last_password_change: number;
  firstTime: string;
  intake: string;
  course_code: string;
  campus: string;
}
export interface StaffModel {
  req_id: number;
  staff_id: string;
  s_name: string;
  s_nickname: string;
  s_email: string;
  s_dept: string;
  s_designation: string;
  s_campus: string;
  s_location: string;
  lvl_access: string;
  s_hiredate: number;
  staff_status: string;
  date_update: number;
}

export interface SubmitStaff {
  staff_id: string;
  s_name: string;
  s_nickname: string;
  s_email: string;
  s_dept: string;
  s_designation: string;
  s_campus: string;
  s_location: string;
  lvl_access: string;
  s_hiredate: number;
  staff_status: string;
}
