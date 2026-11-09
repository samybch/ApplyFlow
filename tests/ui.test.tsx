import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, it, expect } from "vitest";
import { App } from "../src/ui/App";
afterEach(cleanup);
it("ouvre l’interface et valide le formulaire d’offre avec le stockage web réel", async () => {
  render(<App />);
  await screen.findByRole("heading", { name: "Vue d’ensemble" });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une offre" }));
  expect(
    screen.getByRole("dialog", { name: "Nouvelle opportunité" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Entreprise *"), {
    target: { value: "Test UI" },
  });
  fireEvent.change(screen.getByLabelText("Intitulé du poste *"), {
    target: { value: "Analyste" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer l’offre" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Opportunités" })[0]);
  expect(
    await screen.findByRole("heading", { name: "Test UI" }),
  ).toBeInTheDocument();
});
