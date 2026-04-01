"use client";

import { useParams } from "next/navigation";

import { EvaluationProfileFormPage } from "../../ui/evaluation-profile-form-page";

export default function EditEvaluationProfilePage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  return <EvaluationProfileFormPage id={id} />;
}
