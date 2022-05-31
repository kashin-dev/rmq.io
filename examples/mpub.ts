import { rmqio } from "../dist";

const url = "amqp://localhost";
const rmq = rmqio({
  url,
  binarySerialization: true,
});

type json = {
  [key: string]: any;
};
type Message<T> = {
  content: T;
};
type Publish = {
  message: Message<string | json | number>;
  topic: string;
};

rmq.addHook("publish", async () => {
  console.log("inicia");

  let res = await new Promise((resolve, reject) => {
    setTimeout(function () {
      resolve("¡Éxito!"); // ¡Todo salió bien!
    }, 500);
  });

  console.log("\n\nres");
  console.log(res);
});

rmq
  .setRoute("test")
  .start()
  .then(async () => {
    for (let i = 0; i < 1; i++) {
      const resAck = await rmq.publish({
        message: {
          content: {
            hello: "ack",
          },
        },
        topic: "Default",
      });
      console.log(resAck);
    }
    const resNack = await rmq.publish({
      message: {
        content: {
          hello: "nack",
        },
      },
      topic: "nack",
    });
    console.log(resNack);
  });

process.on("SIGINT", () => {
  rmq.closeConn(function () {
    process.exit(1);
  });
});
