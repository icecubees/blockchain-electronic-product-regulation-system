import { fireEvent, render, screen } from "@testing-library/react";
import BlacklistSellerManager from "./BlacklistSellerManager";

test("renders empty blacklist state without restore actions", () => {
  render(<BlacklistSellerManager sellers={[]} loading={false} onRestore={jest.fn()} />);

  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("submits restore request with edited reason and score", () => {
  const onRestore = jest.fn().mockResolvedValue(undefined);
  const seller = {
    id: 8,
    username: "seller-risky",
    ethAddress: "0xabc",
    reputationScore: -20,
  };

  render(<BlacklistSellerManager sellers={[seller]} loading={false} onRestore={onRestore} />);

  const textboxes = screen.getAllByRole("textbox");
  const scoreInput = screen.getByRole("spinbutton");
  const submitButton = screen.getByRole("button");

  fireEvent.change(textboxes[0], {
    target: { value: "manual review completed" },
  });
  fireEvent.change(scoreInput, {
    target: { value: "35" },
  });
  fireEvent.click(submitButton);

  expect(onRestore).toHaveBeenCalledWith(8, "manual review completed", 35);
});
