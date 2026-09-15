import { describe, expect, it } from "vitest";

import { toWriteData } from "./write-data";
import type { CandidateImportRow } from "./parse-candidates";

function row(overrides: Partial<CandidateImportRow> = {}): CandidateImportRow {
  return {
    rowNumber: 2,
    name: "Nij Bhavsar",
    email: "nij@example.com",
    mobile: "9313234412",
    sourceTimestamp: new Date("2026-09-03T18:46:13Z"),
    currentCity: "Surat",
    willingFullTimeSurat: "Yes",
    dateOfBirth: new Date("2005-05-23"),
    highestQualification: "B.E. / B.Tech",
    collegeName: "SNPIT, Bardoli",
    yearOfPassing: "2026",
    cgpaOrPercentage: "8.73",
    technologies: "JavaScript",
    projectInfo: "Mess Management System",
    githubUrl: "https://github.com/nij",
    linkedinUrl: "https://linkedin.com/in/nij",
    liveProjectUrl: "https://nij.dev",
    selfLearningInfo: "Learned JS",
    aiToolsInfo: "ChatGPT",
    reasonForJoining: "Interested in full stack dev",
    resumeUrl: "https://drive.google.com/resume",
    termsAgreement: "I agree",
    informationConfirmation: "I confirm",
    hearAboutProgram: "Friends",
    ...overrides,
  };
}

describe("toWriteData", () => {
  it("includes every populated field", () => {
    const data = toWriteData(row());
    expect(data).toMatchObject({
      name: "Nij Bhavsar",
      email: "nij@example.com",
      mobile: "9313234412",
      currentCity: "Surat",
      collegeName: "SNPIT, Bardoli",
    });
  });

  it("always writes name, email and mobile", () => {
    const data = toWriteData(row({ currentCity: null }));
    expect(data.name).toBe("Nij Bhavsar");
    expect(data.email).toBe("nij@example.com");
    expect(data.mobile).toBe("9313234412");
  });

  it("omits a blank optional field entirely, so an update never overwrites an existing value with null", () => {
    const data = toWriteData(row({ currentCity: null, githubUrl: null }));
    expect(data).not.toHaveProperty("currentCity");
    expect(data).not.toHaveProperty("githubUrl");
  });

  it("includes an optional field when the CSV row carries a value", () => {
    const data = toWriteData(row({ currentCity: "Ahmedabad" }));
    expect(data.currentCity).toBe("Ahmedabad");
  });
});
